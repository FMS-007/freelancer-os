import { Router, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { UserProfileSchema } from '@freelancer-os/shared';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createError } from '../middleware/errorHandler';
import bcrypt from 'bcryptjs';

const router: Router = Router();
router.use(authenticate);

// GET /api/v1/users/profile
router.get('/profile', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: { profile: true },
    });
    if (!user) throw createError('User not found', 404);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/users/profile
router.put('/profile', validate(UserProfileSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, bio, skills, experience, hourlyRate, platforms, timezone } = req.body;

    // Verify the user actually exists before writing anything
    const existingUser = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!existingUser) throw createError('User not found', 404);

    const userUpdate: Record<string, unknown> = {};
    if (name) userUpdate.name = name;
    if (timezone) userUpdate.timezone = timezone;

    const profileUpdate: Record<string, unknown> = {};
    if (bio !== undefined) profileUpdate.bio = bio;
    if (skills !== undefined) profileUpdate.skills = skills;
    if (experience !== undefined) profileUpdate.experience = experience;
    if (hourlyRate !== undefined) profileUpdate.hourlyRate = hourlyRate;
    if (platforms !== undefined) profileUpdate.platforms = platforms;

    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: req.userId },
        data: userUpdate,
        include: { profile: true },
      }),
    ]);

    if (Object.keys(profileUpdate).length > 0) {
      await prisma.userProfile.upsert({
        where: { userId: req.userId! },
        update: profileUpdate,
        create: { userId: req.userId!, skills: [], platforms: [], ...profileUpdate },
      });
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/users/stats
router.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [totalProposals, wonProposals, thisWeek] = await Promise.all([
      prisma.proposal.count({ where: { userId: req.userId } }),
      prisma.proposal.count({ where: { userId: req.userId, status: 'won' } }),
      prisma.proposal.count({
        where: {
          userId: req.userId,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const avgBid = await prisma.proposal.aggregate({
      where: { userId: req.userId },
      _avg: { bidAmount: true },
    });

    res.json({
      totalProposals,
      wonProposals,
      winRate: totalProposals > 0 ? Math.round((wonProposals / totalProposals) * 100) : 0,
      avgBidAmount: Math.round(avgBid._avg.bidAmount || 0),
      proposalsThisWeek: thisWeek,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/users/password
router.put('/password', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw createError('currentPassword and newPassword are required', 400);
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      throw createError('New password must be at least 8 characters', 400);
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw createError('User not found', 404);

    const valid = await bcrypt.compare(currentPassword, user.password ?? '');
    if (!valid) throw createError('Current password is incorrect', 400);

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.userId }, data: { password: hash } });

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/users/account
router.delete('/account', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Delete user and cascade (Prisma will respect onDelete: Cascade set in schema)
    await prisma.user.delete({ where: { id: req.userId } });
    res.json({ message: 'Account deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
