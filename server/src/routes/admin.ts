import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { user } from '../db/schema';
import { requireAuth, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { 
  getAllAdmins, 
  grantAdminPermissions, 
  revokeAdminPermissions,
  isAdminByEmail 
} from '../utils/adminUtils';

const router = Router();

// Get all admin users
router.get('/admins', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const admins = await getAllAdmins();
    res.json(admins);
  } catch (error) {
    console.error('Error fetching admins:', error);
    res.status(500).json({ error: 'Failed to fetch admin users' });
  }
});

// Get all users (for admin management UI)
router.get('/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;
    
    let query = db.select({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isAdmin: user.isAdmin,
      isVerified: user.isVerified,
      totalPoints: user.totalPoints,
      createdAt: user.createdAt
    }).from(user);

    // Add search functionality if provided
    if (search && typeof search === 'string') {
      query = query.where(
        // Simple search - in production you'd want more sophisticated search
        db.raw(`LOWER(email) LIKE LOWER('%${search}%') OR LOWER(name) LIKE LOWER('%${search}%')`)
      );
    }

    const users = await query
      .limit(Number(limit))
      .offset(Number(offset))
      .orderBy(user.createdAt);

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Grant admin permissions to a user
router.post('/grant-admin', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, email } = req.body;
    const adminUser = req.user!;

    if (!userId && !email) {
      return res.status(400).json({ 
        error: 'Either userId or email is required' 
      });
    }

    let targetUserId = userId;
    
    // If email provided, find user ID
    if (!targetUserId && email) {
      const [foundUser] = await db
        .select({ id: user.id, isAdmin: user.isAdmin })
        .from(user)
        .where(eq(user.email, email))
        .limit(1);
      
      if (!foundUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      if (foundUser.isAdmin) {
        return res.status(400).json({ error: 'User is already an admin' });
      }
      
      targetUserId = foundUser.id;
    }

    // Prevent self-modification for safety
    if (targetUserId === adminUser.id) {
      return res.status(400).json({ 
        error: 'Cannot modify your own admin status' 
      });
    }

    const success = await grantAdminPermissions(targetUserId);
    
    if (success) {
      // Get updated user info for response
      const [updatedUser] = await db
        .select({
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin
        })
        .from(user)
        .where(eq(user.id, targetUserId))
        .limit(1);

      res.json({ 
        success: true, 
        message: 'Admin permissions granted successfully',
        user: updatedUser
      });
    } else {
      res.status(500).json({ error: 'Failed to grant admin permissions' });
    }
  } catch (error) {
    console.error('Error granting admin permissions:', error);
    res.status(500).json({ error: 'Failed to grant admin permissions' });
  }
});

// Revoke admin permissions from a user
router.post('/revoke-admin', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.body;
    const adminUser = req.user!;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Prevent self-modification for safety
    if (userId === adminUser.id) {
      return res.status(400).json({ 
        error: 'Cannot revoke your own admin permissions' 
      });
    }

    // Check if user is actually an admin
    const [targetUser] = await db
      .select({ isAdmin: user.isAdmin, email: user.email })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!targetUser.isAdmin) {
      return res.status(400).json({ error: 'User is not an admin' });
    }

    const success = await revokeAdminPermissions(userId);
    
    if (success) {
      // Get updated user info for response
      const [updatedUser] = await db
        .select({
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      res.json({ 
        success: true, 
        message: 'Admin permissions revoked successfully',
        user: updatedUser
      });
    } else {
      res.status(500).json({ error: 'Failed to revoke admin permissions' });
    }
  } catch (error) {
    console.error('Error revoking admin permissions:', error);
    res.status(500).json({ error: 'Failed to revoke admin permissions' });
  }
});

// Check if current user has admin permissions (utility endpoint)
router.get('/check-admin', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const isAdmin = req.user?.isAdmin || false;
    res.json({ isAdmin });
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ error: 'Failed to check admin status' });
  }
});

export default router;