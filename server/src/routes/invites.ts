import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../db';
import { inviteCodes, inviteRegistrations, accessRequests, emailWhitelist, user } from '../db/schema';
import { requireAuth } from '../middleware/auth';
import * as Sentry from '@sentry/node';

const router = Router();

// Get Sentry logger
const { logger } = Sentry;

// Validate invite code - does not require authentication since it's used before signup
router.post('/validate', async (req, res: Response) => {
  try {
    const { code } = req.body;
    
    logger.info('Invite code validation requested', { 
      inviteCode: code, 
      component: 'invite-backend',
      endpoint: '/validate'
    });

    if (!code) {
      logger.warn('Invite code validation failed - no code provided', {
        component: 'invite-backend',
        endpoint: '/validate'
      });
      return res.status(400).json({ error: 'Invite code is required' });
    }

    // Check if code exists and is valid in database
    logger.debug('Looking up invite code in database', { 
      inviteCode: code, 
      component: 'invite-backend' 
    });
    
    const [inviteCode] = await db
      .select()
      .from(inviteCodes)
      .where(
        and(
          eq(inviteCodes.code, code),
          eq(inviteCodes.isActive, true)
        )
      );

    if (!inviteCode) {
      logger.error('Invite code validation failed - code not found', { 
        inviteCode: code, 
        component: 'invite-backend' 
      });
      return res.status(400).json({ error: 'Invalid or expired invite code' });
    }

    // Check if code has expired
    if (inviteCode.expiresAt && new Date() > inviteCode.expiresAt) {
      logger.error('Invite code validation failed - code expired', { 
        inviteCode: code, 
        inviteCodeId: inviteCode.id,
        expiresAt: inviteCode.expiresAt,
        component: 'invite-backend' 
      });
      return res.status(400).json({ error: 'Invite code has expired' });
    }

    // Check if code has reached max uses
    if (inviteCode.usedCount >= inviteCode.maxUses) {
      logger.error('Invite code validation failed - max uses reached', { 
        inviteCode: code, 
        inviteCodeId: inviteCode.id,
        usedCount: inviteCode.usedCount,
        maxUses: inviteCode.maxUses,
        component: 'invite-backend' 
      });
      return res.status(400).json({ error: 'Invite code has been used the maximum number of times' });
    }

    logger.info('Invite code validation successful', { 
      inviteCode: code, 
      inviteCodeId: inviteCode.id,
      component: 'invite-backend' 
    });

    res.json({ valid: true, inviteCodeId: inviteCode.id });
  } catch (error) {
    logger.error('Error validating invite code', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      inviteCode: req.body?.code,
      component: 'invite-backend' 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Use invite code (called after successful Google auth)
router.post('/use', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { inviteCodeId } = req.body;
    const userId = req.user!.id;

    logger.info('Invite code usage requested', { 
      inviteCodeId, 
      userId, 
      component: 'invite-backend',
      endpoint: '/use'
    });

    if (!inviteCodeId) {
      logger.warn('Invite code usage failed - no invite code ID provided', {
        userId,
        component: 'invite-backend',
        endpoint: '/use'
      });
      return res.status(400).json({ error: 'Invite code ID is required' });
    }

    // Verify the invite code still exists and is valid
    const [inviteCode] = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.id, inviteCodeId));

    if (!inviteCode || !inviteCode.isActive) {
      logger.error('Invite code usage failed - invalid invite code', { 
        inviteCodeId, 
        userId,
        inviteCodeExists: !!inviteCode,
        isActive: inviteCode?.isActive,
        component: 'invite-backend' 
      });
      return res.status(400).json({ error: 'Invalid invite code' });
    }

    // Check if user has already used this code
    const [existingRegistration] = await db
      .select()
      .from(inviteRegistrations)
      .where(
        and(
          eq(inviteRegistrations.inviteCodeId, inviteCodeId),
          eq(inviteRegistrations.userId, userId)
        )
      );

    if (existingRegistration) {
      logger.info('Invite code already used by user', { 
        inviteCodeId, 
        userId,
        component: 'invite-backend' 
      });
      return res.json({ success: true, message: 'Already registered with this invite code' });
    }

    // Record the registration
    await db.insert(inviteRegistrations).values({
      inviteCodeId,
      userId,
    });

    // Mark user as verified since they used a valid invite and return updated user
    const [updatedUser] = await db
      .update(user)
      .set({ isVerified: true })
      .where(eq(user.id, userId))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        avatarUrl: user.avatarUrl,
        totalPoints: user.totalPoints,
        role: user.role,
        isOnboarded: user.isOnboarded,
        isVerified: user.isVerified,
        jerseyNumber: user.jerseyNumber,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });

    // Increment the used count
    await db
      .update(inviteCodes)
      .set({ usedCount: inviteCode.usedCount + 1 })
      .where(eq(inviteCodes.id, inviteCodeId));

    logger.info('Invite code used successfully', { 
      inviteCodeId, 
      userId,
      newUsedCount: inviteCode.usedCount + 1,
      component: 'invite-backend' 
    });

    res.json({ 
      success: true, 
      message: 'Invite code used successfully',
      updatedProfile: updatedUser
    });
  } catch (error) {
    logger.error('Error using invite code', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      inviteCodeId: req.body?.inviteCodeId,
      userId: req.user?.id,
      component: 'invite-backend' 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit access request
router.post('/request-access', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name, message } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if there's already a pending request for this email
    const [existingRequest] = await db
      .select()
      .from(accessRequests)
      .where(
        and(
          eq(accessRequests.email, email),
          eq(accessRequests.status, 'pending')
        )
      );

    if (existingRequest) {
      return res.status(400).json({ error: 'Access request already pending for this email' });
    }

    // Create the access request
    await db.insert(accessRequests).values({
      email,
      name,
      message,
    });

    // TODO: Send email notification to admin using Resend
    // This will be implemented once Resend is set up

    res.json({ success: true, message: 'Access request submitted successfully' });
  } catch (error) {
    console.error('Error submitting access request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if email is whitelisted
router.post('/check-whitelist', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const [whitelistEntry] = await db
      .select()
      .from(emailWhitelist)
      .where(eq(emailWhitelist.email, email));

    res.json({ whitelisted: !!whitelistEntry });
  } catch (error) {
    console.error('Error checking whitelist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create invite code for parents
router.post('/codes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code, expiresAt, maxUses } = req.body;
    const userId = req.user!.id;

    logger.info('Invite code creation requested', { 
      inviteCode: code,
      createdBy: userId,
      maxUses: maxUses || 1,
      expiresAt,
      component: 'invite-backend',
      endpoint: '/codes'
    });

    if (!code) {
      logger.warn('Invite code creation failed - no code provided', {
        createdBy: userId,
        component: 'invite-backend',
        endpoint: '/codes'
      });
      return res.status(400).json({ error: 'Invite code is required' });
    }

    // Check if code already exists
    const [existingCode] = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.code, code));

    if (existingCode) {
      logger.error('Invite code creation failed - code already exists', { 
        inviteCode: code,
        createdBy: userId,
        existingCodeId: existingCode.id,
        component: 'invite-backend' 
      });
      return res.status(400).json({ error: 'Invite code already exists' });
    }

    const [newCode] = await db
      .insert(inviteCodes)
      .values({
        code,
        createdBy: userId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxUses: maxUses || 1,
      })
      .returning();

    logger.info('Invite code created successfully', { 
      inviteCode: code,
      inviteCodeId: newCode.id,
      createdBy: userId,
      maxUses: newCode.maxUses,
      expiresAt: newCode.expiresAt,
      component: 'invite-backend' 
    });

    res.json(newCode);
  } catch (error) {
    logger.error('Error creating invite code', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      inviteCode: req.body?.code,
      createdBy: req.user?.id,
      component: 'invite-backend' 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all invite codes (admin only)
router.get('/admin/codes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {  
    // Basic admin check
    if (req.user?.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const codes = await db
      .select({
        id: inviteCodes.id,
        code: inviteCodes.code,
        createdBy: inviteCodes.createdBy,
        createdAt: inviteCodes.createdAt,
        expiresAt: inviteCodes.expiresAt,
        maxUses: inviteCodes.maxUses,
        usedCount: inviteCodes.usedCount,
        isActive: inviteCodes.isActive,
        creatorName: user.name,
      })
      .from(inviteCodes)
      .leftJoin(user, eq(inviteCodes.createdBy, user.id))
      .orderBy(desc(inviteCodes.createdAt));

    res.json(codes);
  } catch (error) {
    console.error('Error fetching invite codes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate invite code
router.patch('/admin/codes/:id/deactivate', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Basic admin check
    if (req.user?.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    await db
      .update(inviteCodes)
      .set({ isActive: false })
      .where(eq(inviteCodes.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deactivating invite code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get access requests
router.get('/admin/requests', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Basic admin check
    if (req.user?.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const requests = await db
      .select()
      .from(accessRequests)
      .orderBy(desc(accessRequests.createdAt));

    res.json(requests);
  } catch (error) {
    console.error('Error fetching access requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Review access request
router.patch('/admin/requests/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Basic admin check
    if (req.user?.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const { status } = req.body;
    const reviewerId = req.user!.id;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    await db
      .update(accessRequests)
      .set({
        status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      })
      .where(eq(accessRequests.id, id));

    // If approved, add to whitelist
    if (status === 'approved') {
      const [request] = await db
        .select()
        .from(accessRequests)
        .where(eq(accessRequests.id, id));

      if (request) {
        // Check if already whitelisted
        const [existing] = await db
          .select()
          .from(emailWhitelist)
          .where(eq(emailWhitelist.email, request.email));

        if (!existing) {
          await db.insert(emailWhitelist).values({
            email: request.email,
            addedBy: reviewerId,
          });
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error reviewing access request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get whitelist
router.get('/admin/whitelist', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Basic admin check
    if (req.user?.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const whitelist = await db
      .select({
        id: emailWhitelist.id,
        email: emailWhitelist.email,
        addedBy: emailWhitelist.addedBy,
        addedAt: emailWhitelist.addedAt,
        addedByName: user.name,
      })
      .from(emailWhitelist)
      .leftJoin(user, eq(emailWhitelist.addedBy, user.id))
      .orderBy(desc(emailWhitelist.addedAt));

    res.json(whitelist);
  } catch (error) {
    console.error('Error fetching whitelist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add to whitelist
router.post('/admin/whitelist', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Basic admin check
    if (req.user?.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { email } = req.body;
    const userId = req.user!.id;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if already whitelisted
    const [existing] = await db
      .select()
      .from(emailWhitelist)
      .where(eq(emailWhitelist.email, email));

    if (existing) {
      return res.status(400).json({ error: 'Email already whitelisted' });
    }

    const [newEntry] = await db
      .insert(emailWhitelist)
      .values({
        email,
        addedBy: userId,
      })
      .returning();

    res.json(newEntry);
  } catch (error) {
    console.error('Error adding to whitelist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove from whitelist
router.delete('/admin/whitelist/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Basic admin check
    if (req.user?.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    await db
      .delete(emailWhitelist)
      .where(eq(emailWhitelist.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing from whitelist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;