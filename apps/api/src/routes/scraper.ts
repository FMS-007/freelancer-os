import { Router, Response, NextFunction } from 'express';
import axios from 'axios';
import { AuthRequest, authenticate } from '../middleware/auth';
import { ScraperQuerySchema } from '@freelancer-os/shared';
import { validate } from '../middleware/validate';
import { getCache, setCache } from '../lib/redis';
import prisma from '../lib/prisma';
import rateLimit from 'express-rate-limit';

const router: Router = Router();

const SCRAPER_URL = process.env.SCRAPER_URL || 'http://localhost:8001';

// GET /api/v1/scraper/status
router.get('/status', async (_req, res) => {
  try {
    await axios.get(`${SCRAPER_URL}/health`, { timeout: 5000 });
    res.json({ status: 'online', url: SCRAPER_URL });
  } catch {
    res.json({ status: 'offline', url: SCRAPER_URL });
  }
});

const scraperLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many scraper requests, please slow down.' },
  keyGenerator: (req) => (req as AuthRequest).userId || req.ip || 'unknown',
});

// POST /api/v1/scraper/search
router.post(
  '/search',
  scraperLimiter,
  validate(ScraperQuerySchema),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { query, platform, limit } = req.body;
      const cacheKey = `scraper:${platform}:${query}:${limit}`;

      const cached = await getCache(cacheKey);
      if (cached) {
        // Cached responses don't have platformOutcomes — return minimal metadata
        res.json({ projects: cached, cached: true, platformOutcomes: {} });
        return;
      }

      let response;
      try {
        response = await axios.post(
          `${SCRAPER_URL}/scrape`,
          { query, platform, limit },
          { timeout: 60000 },
        );
      } catch (scraperErr: unknown) {
        // Connection refused / ECONNREFUSED / timeout → scraper process is down
        const isConnectionError =
          axios.isAxiosError(scraperErr) &&
          (scraperErr.code === 'ECONNREFUSED' ||
            scraperErr.code === 'ENOTFOUND' ||
            scraperErr.code === 'ETIMEDOUT' ||
            !scraperErr.response);

        if (isConnectionError) {
          res.status(503).json({
            error: 'Scraper service is offline. Make sure the Python scraper is running on port 8001.',
            hint: 'Run: cd apps/scraper && python api.py',
            scraperOffline: true,
            projects: [],
            platformOutcomes: {},
          });
        } else {
          // Scraper is up but returned an HTTP error (4xx/5xx from Python side)
          const data = axios.isAxiosError(scraperErr) ? scraperErr.response?.data : {};
          res.status(200).json({
            projects: [],
            platformOutcomes: {},
            scraperError: true,
            error: data?.error ?? String(scraperErr),
          });
        }
        return;
      }

      const projects         = response.data.projects ?? [];
      const platformOutcomes = response.data.platformOutcomes ?? {};

      // Only cache when at least one platform succeeded
      const anySuccess = Object.values(platformOutcomes as Record<string, { status: string }>)
        .some(o => o.status === 'success');
      if (anySuccess || projects.length > 0) {
        await setCache(cacheKey, projects, 300);
      }

      res.json({
        projects,
        platformOutcomes,
        cached: false,
        total: response.data.total ?? projects.length,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/scraper/save  — saves a matched project to ProjectRecord (deduplicates by URL)
router.post('/save', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, description, budget, skills, clientCountry, url, platform } = req.body;

    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }

    // Deduplicate by URL for this user
    if (url) {
      const existing = await prisma.projectRecord.findFirst({
        where: { userId: req.userId!, url },
      });
      if (existing) {
        res.json({ saved: false, duplicate: true, record: existing });
        return;
      }
    }

    const record = await prisma.projectRecord.create({
      data: {
        userId:        req.userId!,
        title:         String(title || '').trim() || 'Untitled Project',
        description:   String(description || ''),
        clientCountry: String(clientCountry || 'Unknown'),
        techStack:     Array.isArray(skills) ? skills : [],
        platform:      String(platform || 'upwork'),
        url:           url ? String(url) : null,
        bidAmount:     0,
      },
    });

    res.json({ saved: true, duplicate: false, record });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/scraper/saved — list user's saved projects
router.get('/saved', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const records = await prisma.projectRecord.findMany({
      where:   { userId: req.userId! },
      orderBy: { scrapedAt: 'desc' },
      take:    200,
    });
    res.json({ records });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/scraper/saved/:id — remove a saved project
router.delete('/saved/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.projectRecord.deleteMany({ where: { id, userId: req.userId! } });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
