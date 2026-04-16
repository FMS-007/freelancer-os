import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// GET /api/v1/analytics/dashboard
router.get('/dashboard', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [totalProposals, wonProposals, weeklyProposals, avgBid, alertConfig, recentProposals] = await Promise.all([
      prisma.proposal.count({ where: { userId: req.userId, isReference: false } }),
      prisma.proposal.count({ where: { userId: req.userId, status: 'won' } }),
      prisma.proposal.count({ where: { userId: req.userId, isReference: false, createdAt: { gte: weekAgo } } }),
      prisma.proposal.aggregate({ where: { userId: req.userId }, _avg: { bidAmount: true } }),
      prisma.alertConfig.findUnique({ where: { userId: req.userId } }),
      prisma.proposal.findMany({
        where: { userId: req.userId, isReference: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, projectTitle: true, status: true, bidAmount: true, platform: true, createdAt: true },
      }),
    ]);

    res.json({
      totalProposals,
      wonProposals,
      winRate: totalProposals > 0 ? Math.round((wonProposals / totalProposals) * 100) : 0,
      avgBidAmount: Math.round(avgBid._avg.bidAmount || 0),
      proposalsThisWeek: weeklyProposals,
      activeAlerts: alertConfig?.countries?.length || 0,
      recentProposals,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/analytics/timeline
router.get('/timeline', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const days = Number(req.query.days) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const proposals = await prisma.proposal.findMany({
      where: { userId: req.userId, isReference: false, createdAt: { gte: startDate } },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const byDay: Record<string, { total: number; won: number }> = {};
    proposals.forEach(p => {
      const day = p.createdAt.toISOString().split('T')[0];
      if (!byDay[day]) byDay[day] = { total: 0, won: 0 };
      byDay[day].total++;
      if (p.status === 'won') byDay[day].won++;
    });

    const timeline = Object.entries(byDay).map(([date, data]) => ({
      date,
      proposals: data.total,
      won: data.won,
    }));

    res.json(timeline);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/analytics/heatmap
router.get('/heatmap', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const proposals = await prisma.proposal.findMany({
      where: { userId: req.userId, isReference: false },
      select: { createdAt: true, status: true },
    });

    // Heatmap: [hour][dayOfWeek] = count
    const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    const winmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));

    proposals.forEach(p => {
      const day = p.createdAt.getUTCDay();
      const hour = p.createdAt.getUTCHours();
      heatmap[day][hour]++;
      if (p.status === 'won') winmap[day][hour]++;
    });

    res.json({ heatmap, winmap });
  } catch (err) {
    next(err);
  }
});

export default router;
