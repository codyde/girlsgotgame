import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db';
import { user, parentChildRelations } from '../db/schema';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { createProfileSchema, updateProfileSchema, addPointsSchema } from '../types';

const router = Router();

// Get current user profile
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
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
        isVerified: true,
        jerseyNumber: true,
        createdAt: true,
        updatedAt: true
      }
    });

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
        isVerified: user.isVerified,
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
    const validatedData = updateProfileSchema.parse(req.body);

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
        isVerified: user.isVerified,
        jerseyNumber: user.jerseyNumber,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });
    
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

// New multi-child relationship endpoints

// Get all parent-child relationships (new format)
router.get('/admin/parent-child-relationships', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Basic admin check
    if (req.user?.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get all relationships
    const relationships = await db
      .select()
      .from(parentChildRelations)
      .orderBy(desc(parentChildRelations.createdAt));

    // Get all users to lookup parent and child info
    const users = await db.select().from(user);
    const userMap = users.reduce((acc, u) => {
      acc[u.id] = u;
      return acc;
    }, {} as any);

    // Group relationships by parent
    const groupedRelations = relationships.reduce((acc, rel) => {
      if (!acc[rel.parentId]) {
        const parent = userMap[rel.parentId];
        acc[rel.parentId] = {
          parentId: rel.parentId,
          parentName: parent?.name,
          parentEmail: parent?.email,
          children: []
        };
      }
      if (rel.childId) {
        const child = userMap[rel.childId];
        acc[rel.parentId].children.push({
          id: rel.id,
          childId: rel.childId,
          childName: child?.name,
          childEmail: child?.email,
          createdAt: rel.createdAt
        });
      }
      return acc;
    }, {} as any);

    res.json(Object.values(groupedRelations));
  } catch (error) {
    console.error('Get parent-child relationships error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add parent-child relationship
router.post('/admin/parent-child-relationships', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Basic admin check
    if (req.user?.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { parentId, childId } = req.body;

    if (!parentId || !childId) {
      return res.status(400).json({ error: 'Parent ID and Child ID are required' });
    }

    // Check if relationship already exists
    const existingRelation = await db
      .select()
      .from(parentChildRelations)
      .where(
        and(
          eq(parentChildRelations.parentId, parentId),
          eq(parentChildRelations.childId, childId)
        )
      );

    if (existingRelation.length > 0) {
      return res.status(400).json({ error: 'Relationship already exists' });
    }

    // Create the relationship
    const [newRelation] = await db
      .insert(parentChildRelations)
      .values({
        parentId,
        childId,
        createdBy: req.user!.id,
      })
      .returning();

    res.json(newRelation);
  } catch (error) {
    console.error('Add parent-child relationship error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove parent-child relationship
router.delete('/admin/parent-child-relationships/:relationId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Basic admin check
    if (req.user?.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { relationId } = req.params;

    await db
      .delete(parentChildRelations)
      .where(eq(parentChildRelations.id, relationId));

    res.json({ success: true });
  } catch (error) {
    console.error('Remove parent-child relationship error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve user (mark as verified)
router.patch('/admin/approve/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Basic admin check
    if (req.user?.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Update user to set isVerified to true
    const [updatedUser] = await db
      .update(user)
      .set({ isVerified: true })
      .where(eq(user.id, userId))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, message: 'User approved successfully' });
  } catch (error) {
    console.error('Error approving user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Add points to a player
router.patch('/admin/:userId/add-points', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Basic admin check
    if (req.user?.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userId } = req.params;
    const validatedData = addPointsSchema.parse(req.body);

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get current user to check if they exist and get current points
    const currentUser = await db.query.user.findFirst({
      where: eq(user.id, userId)
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user's total points by adding the new points
    const [updatedUser] = await db
      .update(user)
      .set({
        totalPoints: (currentUser.totalPoints || 0) + validatedData.points,
        updatedAt: new Date()
      })
      .where(eq(user.id, userId))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        totalPoints: user.totalPoints,
        updatedAt: user.updatedAt
      });

    res.json({
      success: true,
      message: `Successfully added ${validatedData.points} points to ${updatedUser.name || updatedUser.email}`,
      user: updatedUser,
      pointsAdded: validatedData.points,
      reason: validatedData.reason || 'Manual adjustment by admin'
    });
  } catch (error) {
    console.error('Error adding points to user:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid data', details: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;