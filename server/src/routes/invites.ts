import { Router } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db';
import { user, inviteCodes, inviteRegistrations, emailWhitelist, bannedEmails, accessRequests } from '../db/schema';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

// Generate a secure invite code
const generateInviteCode = (): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// Check if email is eligible for registration (no auth required for validation)
router.get('/check-eligibility/:email', async (req, res) => {
  try {
    const { email } = req.params;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if email is banned
    const bannedEmail = await db.query.bannedEmails.findFirst({
      where: eq(bannedEmails.email, email.toLowerCase())
    });

    if (bannedEmail) {
      return res.json({
        eligible: false,
        reason: 'banned',
        message: 'This email address has been banned from registration'
      });
    }

    // Check if email is whitelisted
    const whitelistedEmail = await db.query.emailWhitelist.findFirst({
      where: eq(emailWhitelist.email, email.toLowerCase())
    });

    if (whitelistedEmail) {
      return res.json({
        eligible: true,
        reason: 'whitelisted',
        message: 'Email is pre-approved for registration'
      });
    }

    // Check if user already exists
    const existingUser = await db.query.user.findFirst({
      where: eq(user.email, email.toLowerCase())
    });

    if (existingUser) {
      return res.json({
        eligible: false,
        reason: 'exists',
        message: 'Account already exists for this email'
      });
    }

    // Check if there's a pending access request
    const pendingRequest = await db.query.accessRequests.findFirst({
      where: and(
        eq(accessRequests.email, email.toLowerCase()),
        eq(accessRequests.status, 'pending')
      )
    });

    if (pendingRequest) {
      return res.json({
        eligible: false,
        reason: 'pending_request',
        message: 'Access request already submitted and pending review'
      });
    }

    // Check if there's an approved access request
    const approvedRequest = await db.query.accessRequests.findFirst({
      where: and(
        eq(accessRequests.email, email.toLowerCase()),
        eq(accessRequests.status, 'approved')
      )
    });

    if (approvedRequest) {
      return res.json({
        eligible: true,
        reason: 'approved_request',
        message: 'Access request has been approved'
      });
    }

    // Email needs to request access or use invite code
    return res.json({
      eligible: false,
      reason: 'needs_invite_or_request',
      message: 'Registration requires an invite code or access request approval'
    });

  } catch (error) {
    console.error('Check eligibility error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validate invite code (no auth required for validation)
router.get('/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    const invite = await db.query.inviteCodes.findFirst({
      where: and(
        eq(inviteCodes.code, code.toUpperCase()),
        eq(inviteCodes.isActive, true)
      ),
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!invite) {
      return res.json({
        valid: false,
        error: 'Invalid invite code'
      });
    }

    // Check if expired
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return res.json({
        valid: false,
        error: 'Invite code has expired'
      });
    }

    // Check if used up
    if (invite.usedCount >= invite.maxUses) {
      return res.json({
        valid: false,
        error: 'Invite code has been fully used'
      });
    }

    return res.json({
      valid: true,
      inviteCode: {
        id: invite.id,
        code: invite.code,
        createdBy: invite.creator.name || invite.creator.email,
        maxUses: invite.maxUses,
        usedCount: invite.usedCount,
        expiresAt: invite.expiresAt
      }
    });

  } catch (error) {
    console.error('Validate invite code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate new invite code (parents only)
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const { maxUses = 1, expiresInDays } = req.body;

    // Check if user is parent
    const userProfile = await db.query.user.findFirst({
      where: eq(user.id, req.user!.id)
    });

    if (!userProfile || userProfile.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can generate invite codes' });
    }

    // Validate inputs
    if (maxUses < 1 || maxUses > 100) {
      return res.status(400).json({ error: 'Max uses must be between 1 and 100' });
    }

    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    // Generate unique code
    let code = generateInviteCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.query.inviteCodes.findFirst({
        where: eq(inviteCodes.code, code)
      });
      if (!existing) break;
      code = generateInviteCode();
      attempts++;
    }

    if (attempts >= 10) {
      return res.status(500).json({ error: 'Failed to generate unique invite code' });
    }

    // Create invite code
    const [newInvite] = await db.insert(inviteCodes).values({
      code,
      createdBy: req.user!.id,
      maxUses,
      expiresAt
    }).returning();

    res.json({
      id: newInvite.id,
      code: newInvite.code,
      maxUses: newInvite.maxUses,
      usedCount: newInvite.usedCount,
      expiresAt: newInvite.expiresAt,
      createdAt: newInvite.createdAt
    });

  } catch (error) {
    console.error('Generate invite code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's invite codes (parents only)
router.get('/my-invites', requireAuth, async (req, res) => {
  try {
    const userProfile = await db.query.user.findFirst({
      where: eq(user.id, req.user!.id)
    });

    if (!userProfile || userProfile.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can view invite codes' });
    }

    const invites = await db.query.inviteCodes.findMany({
      where: eq(inviteCodes.createdBy, req.user!.id),
      orderBy: [desc(inviteCodes.createdAt)],
      with: {
        registrations: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    const formattedInvites = invites.map(invite => ({
      id: invite.id,
      code: invite.code,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
      isActive: invite.isActive,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      registrations: invite.registrations.map(reg => ({
        id: reg.id,
        userId: reg.user.id,
        userName: reg.user.name || reg.user.email,
        userEmail: reg.user.email,
        registeredAt: reg.registeredAt
      }))
    }));

    res.json(formattedInvites);

  } catch (error) {
    console.error('Get my invites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate invite code (parents only)
router.patch('/:inviteId/deactivate', requireAuth, async (req, res) => {
  try {
    const { inviteId } = req.params;

    const invite = await db.query.inviteCodes.findFirst({
      where: eq(inviteCodes.id, inviteId)
    });

    if (!invite) {
      return res.status(404).json({ error: 'Invite code not found' });
    }

    if (invite.createdBy !== req.user!.id) {
      return res.status(403).json({ error: 'You can only deactivate your own invite codes' });
    }

    await db.update(inviteCodes)
      .set({ isActive: false })
      .where(eq(inviteCodes.id, inviteId));

    res.json({ message: 'Invite code deactivated' });

  } catch (error) {
    console.error('Deactivate invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Use invite code (called during registration)
router.post('/use/:code', requireAuth, async (req, res) => {
  try {
    const { code } = req.params;

    // First validate the code
    const invite = await db.query.inviteCodes.findFirst({
      where: and(
        eq(inviteCodes.code, code.toUpperCase()),
        eq(inviteCodes.isActive, true)
      ),
      with: {
        creator: {
          columns: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!invite) {
      return res.status(400).json({ error: 'Invalid invite code' });
    }

    // Check if expired
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return res.status(400).json({ error: 'Invite code has expired' });
    }

    // Check if used up
    if (invite.usedCount >= invite.maxUses) {
      return res.status(400).json({ error: 'Invite code has been fully used' });
    }

    // Check if user already used this code
    const existingRegistration = await db.query.inviteRegistrations.findFirst({
      where: and(
        eq(inviteRegistrations.inviteCodeId, invite.id),
        eq(inviteRegistrations.userId, req.user!.id)
      )
    });

    if (existingRegistration) {
      return res.status(400).json({ error: 'You have already used this invite code' });
    }

    // Record the usage
    await db.insert(inviteRegistrations).values({
      inviteCodeId: invite.id,
      userId: req.user!.id
    });

    // Update usage count
    await db.update(inviteCodes)
      .set({ usedCount: sql`${inviteCodes.usedCount} + 1` })
      .where(eq(inviteCodes.id, invite.id));

    res.json({
      success: true,
      inviteCreator: invite.creator.name,
      inviteCreatorId: invite.creator.id
    });

  } catch (error) {
    console.error('Use invite code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get all invite codes with analytics
router.get('/admin/all', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const userProfile = await db.query.user.findFirst({
      where: eq(user.id, req.user!.id)
    });

    if (!userProfile || userProfile.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const invites = await db.query.inviteCodes.findMany({
      orderBy: [desc(inviteCodes.createdAt)],
      with: {
        creator: {
          columns: {
            id: true,
            name: true,
            email: true
          }
        },
        registrations: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    const formattedInvites = invites.map(invite => ({
      id: invite.id,
      code: invite.code,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
      isActive: invite.isActive,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      creator: {
        id: invite.creator.id,
        name: invite.creator.name || invite.creator.email,
        email: invite.creator.email
      },
      registrations: invite.registrations.map(reg => ({
        id: reg.id,
        userId: reg.user.id,
        userName: reg.user.name || reg.user.email,
        userEmail: reg.user.email,
        registeredAt: reg.registeredAt
      }))
    }));

    res.json(formattedInvites);

  } catch (error) {
    console.error('Admin get all invites error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;