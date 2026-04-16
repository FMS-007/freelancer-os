import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { redis } from '../lib/redis';
import { SignupSchema, LoginSchema } from '@freelancer-os/shared';
import { validate } from '../middleware/validate';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createError } from '../middleware/errorHandler';

const router = Router();

function generateTokens(userId: string) {
  const secret = process.env.JWT_SECRET!;
  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!;

  const accessToken = jwt.sign({ userId }, secret, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, refreshSecret, { expiresIn: '7d' });

  return { accessToken, refreshToken };
}

// POST /api/v1/auth/signup
router.post('/signup', validate(SignupSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw createError('Email already registered', 409);

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
        profile: {
          create: { skills: [], platforms: [] },
        },
      },
      select: { id: true, email: true, name: true, timezone: true, avatarUrl: true },
    });

    const { accessToken, refreshToken } = generateTokens(user.id);
    await redis.set(`refresh:${user.id}`, refreshToken, 'EX', 60 * 60 * 24 * 7);

    res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login
router.post('/login', validate(LoginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });
    if (!user || !user.password) throw createError('Invalid credentials', 401);

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw createError('Invalid credentials', 401);

    // Auto-heal: create UserProfile if somehow it doesn't exist (e.g. migration gap)
    if (!user.profile) {
      await prisma.userProfile.create({
        data: { userId: user.id, skills: [], platforms: [] },
      });
    }

    const { accessToken, refreshToken } = generateTokens(user.id);
    await redis.set(`refresh:${user.id}`, refreshToken, 'EX', 60 * 60 * 24 * 7);

    res.json({
      user: { id: user.id, email: user.email, name: user.name, timezone: user.timezone, avatarUrl: user.avatarUrl },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw createError('Refresh token required', 400);

    const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!;
    const payload = jwt.verify(refreshToken, refreshSecret) as { userId: string };

    const stored = await redis.get(`refresh:${payload.userId}`);
    if (stored !== refreshToken) throw createError('Invalid refresh token', 401);

    const { accessToken, refreshToken: newRefresh } = generateTokens(payload.userId);
    await redis.set(`refresh:${payload.userId}`, newRefresh, 'EX', 60 * 60 * 24 * 7);

    res.json({ accessToken, refreshToken: newRefresh });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await redis.del(`refresh:${req.userId}`);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, timezone: true, avatarUrl: true, createdAt: true },
    });
    if (!user) throw createError('User not found', 404);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

export default router;
