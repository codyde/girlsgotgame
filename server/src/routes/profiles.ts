import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db';
import { user } from '../db/schema';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { createProfileSchema, updateProfileSchema } from '../types';

const router = Router();

// Get current user profile
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    console.log('📖 Profile GET request for user:', req.user!.id);
    const userProfile = await db.query.user.findFirst({
      where: eq(user.id, req.user!.id),
      columns: {
        id: true,
        name: true,
        email: true,
        image: true,
        avatarUrl: true,
        totalPoints: true,
        role: true,
        childId: true,
        isOnboarded: true,
        jerseyNumber: true,
        createdAt: true,
        updatedAt: true
      }
    });
    console.log('📖 User profile found in DB:', JSON.stringify(userProfile, null, 2));

    if (!userProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(userProfile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update profile (now just updates user fields)
router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createProfileSchema.parse({
      email: req.user!.email,
      ...req.body
    });

    // Update user with profile data
    const [updatedUser] = await db.update(user)
      .set({
        name: validatedData.name,
        role: validatedData.role,
        isOnboarded: validatedData.isOnboarded,
        totalPoints: validatedData.totalPoints || 0,
        updatedAt: new Date()
      })
      .where(eq(user.id, req.user!.id))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        avatarUrl: user.avatarUrl,
        totalPoints: user.totalPoints,
        role: user.role,
        childId: user.childId,
        isOnboarded: user.isOnboarded,
        jerseyNumber: user.jerseyNumber,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });

    res.status(201).json(updatedUser);
  } catch (error) {
    console.error('Create profile error:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid data', details: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update profile
router.patch('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    console.log('📝 Profile update request body:', JSON.stringify(req.body, null, 2));
    const validatedData = updateProfileSchema.parse(req.body);
    console.log('📝 Validated data:', JSON.stringify(validatedData, null, 2));

    const [updatedUser] = await db.update(user)
      .set({
        ...validatedData,
        updatedAt: new Date()
      })
      .where(eq(user.id, req.user!.id))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        avatarUrl: user.avatarUrl,
        totalPoints: user.totalPoints,
        role: user.role,
        childId: user.childId,
        isOnboarded: user.isOnboarded,
        jerseyNumber: user.jerseyNumber,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });
    
    console.log('📝 Updated user profile from DB:', JSON.stringify(updatedUser, null, 2));

    if (!updatedUser) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error('Update profile error:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid data', details: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const leaderboard = await db.query.user.findMany({
      orderBy: [desc(user.totalPoints)],
      limit: 100,
      columns: {
        id: true,
        name: true,
        totalPoints: true,
        jerseyNumber: true,
        avatarUrl: true
      }
    });

    res.json(leaderboard);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get profile by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const profile = await db.query.user.findFirst({
      where: eq(user.id, id),
      columns: {
        id: true,
        name: true,
        avatarUrl: true,
        totalPoints: true,
        jerseyNumber: true,
        role: true,
        createdAt: true
      }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profile);
  } catch (error) {
    console.error('Get profile by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Get all player profiles (for parent dashboard)
router.get('/players', async (req, res) => {
  try {
    const players = await db.query.user.findMany({
      where: eq(user.role, 'player'),
      orderBy: [desc(user.totalPoints)],
      columns: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        totalPoints: true,
        jerseyNumber: true,
        createdAt: true
      }
    });

    res.json(players);
  } catch (error) {
    console.error('Get players error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get all profiles
router.get('/admin/all', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Basic admin check - in production you'd want proper role-based auth
    if (req.user!.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const allProfiles = await db.query.user.findMany({
      orderBy: [desc(user.totalPoints)]
    });

    res.json(allProfiles);
  } catch (error) {
    console.error('Get all profiles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get parent-child relationships
router.get('/admin/relations', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Basic admin check
    if (req.user!.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const parentProfiles = await db.query.user.findMany({
      where: eq(user.role, 'parent'),
      with: {
        child: true
      }
    });

    const relations = parentProfiles.map(parent => ({
      parent,
      child: parent.child || null
    }));

    res.json(relations);
  } catch (error) {
    console.error('Get parent relations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Update child assignment
router.patch('/admin/:parentId/child', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Basic admin check
    if (req.user!.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { parentId } = req.params;
    const { childId } = req.body;

    const [updatedProfile] = await db.update(user)
      .set({
        childId: childId || null,
        updatedAt: new Date()
      })
      .where(eq(user.id, parentId))
      .returning();

    if (!updatedProfile) {
      return res.status(404).json({ error: 'Parent profile not found' });
    }

    res.json(updatedProfile);
  } catch (error) {
    console.error('Update child assignment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;