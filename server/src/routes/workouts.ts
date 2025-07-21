import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db';
import { workouts, user } from '../db/schema';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { createWorkoutSchema } from '../types';

const router = Router();

// Get user's workouts
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const userWorkouts = await db.query.workouts.findMany({
      where: eq(workouts.userId, req.user!.id),
      orderBy: [desc(workouts.createdAt)],
      limit: Number(limit),
      offset: Number(offset)
    });

    res.json(userWorkouts);
  } catch (error) {
    console.error('Get workouts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create workout
router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const validatedData = createWorkoutSchema.parse(req.body);

    // Start transaction to create workout and update user points
    const result = await db.transaction(async (tx) => {
      // Create workout
      const [newWorkout] = await tx.insert(workouts).values({
        userId: req.user!.id,
        ...validatedData
      }).returning();

      // Get current user points
      const currentUser = await tx.query.user.findFirst({
        where: eq(user.id, req.user!.id)
      });

      // Update user's total points
      await tx.update(user)
        .set({
          totalPoints: (currentUser?.totalPoints || 0) + validatedData.pointsEarned,
          updatedAt: new Date()
        })
        .where(eq(user.id, req.user!.id));

      return newWorkout;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Create workout error:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid data', details: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workout by ID
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const workout = await db.query.workouts.findFirst({
      where: and(
        eq(workouts.id, id),
        eq(workouts.userId, req.user!.id)
      )
    });

    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    res.json(workout);
  } catch (error) {
    console.error('Get workout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete workout
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Get workout first to check ownership and get points
    const workout = await db.query.workouts.findFirst({
      where: and(
        eq(workouts.id, id),
        eq(workouts.userId, req.user!.id)
      )
    });

    if (!workout) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    // Start transaction to delete workout and update user points
    await db.transaction(async (tx) => {
      // Delete workout
      await tx.delete(workouts).where(eq(workouts.id, id));

      // Get current user points
      const currentUser = await tx.query.user.findFirst({
        where: eq(user.id, req.user!.id)
      });

      // Update user's total points (subtract)
      await tx.update(user)
        .set({
          totalPoints: Math.max(0, (currentUser?.totalPoints || 0) - workout.pointsEarned),
          updatedAt: new Date()
        })
        .where(eq(user.id, req.user!.id));
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete workout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workout stats for user
router.get('/stats/summary', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userWorkouts = await db.query.workouts.findMany({
      where: eq(workouts.userId, req.user!.id)
    });

    const stats = {
      totalWorkouts: userWorkouts.length,
      totalPoints: userWorkouts.reduce((sum, w) => sum + w.pointsEarned, 0),
      totalMinutes: userWorkouts.reduce((sum, w) => sum + w.durationMinutes, 0),
      byType: {
        dribbling: userWorkouts.filter(w => w.exerciseType === 'dribbling').length,
        shooting: userWorkouts.filter(w => w.exerciseType === 'shooting').length,
        conditioning: userWorkouts.filter(w => w.exerciseType === 'conditioning').length
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('Get workout stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workouts for a specific user (for parent dashboard)
router.get('/user/:userId', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const userWorkouts = await db.query.workouts.findMany({
      where: eq(workouts.userId, userId),
      orderBy: [desc(workouts.createdAt)],
      limit: Number(limit),
      offset: Number(offset),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true
          }
        }
      }
    });

    res.json(userWorkouts);
  } catch (error) {
    console.error('Get user workouts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get all workouts with user user
router.get('/admin/all', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Basic admin check - in production you'd want proper role-based auth
    if (req.user!.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const allWorkouts = await db.query.workouts.findMany({
      orderBy: [desc(workouts.createdAt)],
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            totalPoints: true
          }
        }
      }
    });

    res.json(allWorkouts);
  } catch (error) {
    console.error('Get all workouts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;