import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { user, emailWhitelist, bannedEmails } from '../db/schema';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Admin check middleware
const requireAdmin = async (req: AuthenticatedRequest, res: any, next: any) => {
  const userProfile = await db.query.user.findFirst({
    where: eq(user.id, req.user!.id)
  });

  if (!userProfile || userProfile.email !== 'codydearkland@gmail.com') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

// Get email whitelist
router.get('/whitelist', requireAuth, requireAdmin, async (req, res) => {
  try {
    const whitelist = await db.query.emailWhitelist.findMany({
      with: {
        addedByUser: {
          columns: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: (whitelist, { desc }) => [desc(whitelist.addedAt)]
    });

    const formattedWhitelist = whitelist.map(item => ({
      id: item.id,
      email: item.email,
      addedAt: item.addedAt,
      addedBy: {
        id: item.addedByUser.id,
        name: item.addedByUser.name || item.addedByUser.email,
        email: item.addedByUser.email
      }
    }));

    res.json(formattedWhitelist);
  } catch (error) {
    console.error('Get whitelist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add email to whitelist
router.post('/whitelist', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is already whitelisted
    const existingWhitelist = await db.query.emailWhitelist.findFirst({
      where: eq(emailWhitelist.email, normalizedEmail)
    });

    if (existingWhitelist) {
      return res.status(400).json({ error: 'Email is already whitelisted' });
    }

    // Add to whitelist
    await db.insert(emailWhitelist).values({
      email: normalizedEmail,
      addedBy: req.user!.id
    });

    res.json({ message: 'Email added to whitelist successfully' });
  } catch (error) {
    console.error('Add to whitelist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove email from whitelist
router.delete('/whitelist/:whitelistId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { whitelistId } = req.params;

    const whitelist = await db.query.emailWhitelist.findFirst({
      where: eq(emailWhitelist.id, whitelistId)
    });

    if (!whitelist) {
      return res.status(404).json({ error: 'Whitelist entry not found' });
    }

    await db.delete(emailWhitelist)
      .where(eq(emailWhitelist.id, whitelistId));

    res.json({ message: 'Email removed from whitelist' });
  } catch (error) {
    console.error('Remove from whitelist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get banned emails
router.get('/banned-emails', requireAuth, requireAdmin, async (req, res) => {
  try {
    const bannedList = await db.query.bannedEmails.findMany({
      with: {
        bannedByUser: {
          columns: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: (bannedEmails, { desc }) => [desc(bannedEmails.bannedAt)]
    });

    const formattedBannedList = bannedList.map(item => ({
      id: item.id,
      email: item.email,
      reason: item.reason,
      bannedAt: item.bannedAt,
      bannedBy: {
        id: item.bannedByUser.id,
        name: item.bannedByUser.name || item.bannedByUser.email,
        email: item.bannedByUser.email
      }
    }));

    res.json(formattedBannedList);
  } catch (error) {
    console.error('Get banned emails error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ban email address
router.post('/ban-email', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, reason } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is already banned
    const existingBan = await db.query.bannedEmails.findFirst({
      where: eq(bannedEmails.email, normalizedEmail)
    });

    if (existingBan) {
      return res.status(400).json({ error: 'Email is already banned' });
    }

    // Check if user exists and remove them if so
    const existingUser = await db.query.user.findFirst({
      where: eq(user.email, normalizedEmail)
    });

    if (existingUser) {
      // Remove the user account
      await db.delete(user)
        .where(eq(user.id, existingUser.id));
      
      console.log(`User ${existingUser.email} (${existingUser.id}) was removed due to email ban`);
    }

    // Remove from whitelist if present
    await db.delete(emailWhitelist)
      .where(eq(emailWhitelist.email, normalizedEmail));

    // Add to banned list
    await db.insert(bannedEmails).values({
      email: normalizedEmail,
      bannedBy: req.user!.id,
      reason: reason?.trim() || null
    });

    res.json({ 
      message: 'Email banned successfully',
      userRemoved: !!existingUser
    });
  } catch (error) {
    console.error('Ban email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Unban email address
router.delete('/ban-email/:banId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { banId } = req.params;

    const ban = await db.query.bannedEmails.findFirst({
      where: eq(bannedEmails.id, banId)
    });

    if (!ban) {
      return res.status(404).json({ error: 'Ban entry not found' });
    }

    await db.delete(bannedEmails)
      .where(eq(bannedEmails.id, banId));

    res.json({ message: 'Email unbanned successfully' });
  } catch (error) {
    console.error('Unban email error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove user
router.delete('/users/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, banEmail = false } = req.body;

    // Find the user
    const userToRemove = await db.query.user.findFirst({
      where: eq(user.id, userId)
    });

    if (!userToRemove) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow admin to remove themselves
    if (userToRemove.id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot remove your own admin account' });
    }

    // Ban email if requested
    if (banEmail) {
      const existingBan = await db.query.bannedEmails.findFirst({
        where: eq(bannedEmails.email, userToRemove.email)
      });

      if (!existingBan) {
        await db.insert(bannedEmails).values({
          email: userToRemove.email,
          bannedBy: req.user!.id,
          reason: reason || 'Account removed by admin'
        });
      }
    }

    // Remove user account
    await db.delete(user)
      .where(eq(user.id, userId));

    console.log(`User ${userToRemove.email} (${userToRemove.id}) was removed by admin. Reason: ${reason || 'No reason provided'}`);

    res.json({ 
      message: 'User removed successfully',
      emailBanned: banEmail
    });
  } catch (error) {
    console.error('Remove user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user management data (users with detailed info)
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await db.query.user.findMany({
      orderBy: (user, { desc }) => [desc(user.createdAt)]
    });

    const formattedUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      totalPoints: u.totalPoints,
      isOnboarded: u.isOnboarded,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;