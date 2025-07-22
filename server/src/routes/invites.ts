import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../db';
import { inviteCodes, inviteRegistrations, accessRequests, emailWhitelist, user } from '../db/schema';
import { requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

// Validate invite code
router.post('/validate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    console.log('🎫 Validating invite code - Request body:', req.body);
    const { code } = req.body;

    console.log('🎫 Extracted code:', code);

    if (!code) {
      console.log('🎫 No code provided');
      return res.status(400).json({ error: 'Invite code is required' });
    }

    // Check for temporary static code first (for testing)
    if (code === 'TEST123') {
      console.log('🎫 Static test code detected');
      return res.json({ 
        valid: true, 
        inviteCodeId: 'static-test-code',
        message: 'Using temporary test code' 
      });
    }

    // Check if code exists and is valid in database
    console.log('🎫 Looking up code in database:', code);
    const [inviteCode] = await db
      .select()
      .from(inviteCodes)
      .where(
        and(
          eq(inviteCodes.code, code),
          eq(inviteCodes.isActive, true)
        )
      );

    console.log('🎫 Database result:', inviteCode);

    if (!inviteCode) {
      console.log('🎫 Code not found in database');
      return res.status(400).json({ error: 'Invalid or expired invite code' });
    }

    // Check if code has expired
    if (inviteCode.expiresAt && new Date() > inviteCode.expiresAt) {
      return res.status(400).json({ error: 'Invite code has expired' });
    }

    // Check if code has reached max uses
    if (inviteCode.usedCount >= inviteCode.maxUses) {
      return res.status(400).json({ error: 'Invite code has been used the maximum number of times' });
    }

    res.json({ valid: true, inviteCodeId: inviteCode.id });
  } catch (error) {
    console.error('Error validating invite code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Use invite code (called after successful Google auth)
router.post('/use', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { inviteCodeId } = req.body;
    const userId = req.user!.id;

    if (!inviteCodeId) {
      return res.status(400).json({ error: 'Invite code ID is required' });
    }

    // Verify the invite code still exists and is valid
    const [inviteCode] = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.id, inviteCodeId));

    if (!inviteCode || !inviteCode.isActive) {
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
      return res.json({ success: true, message: 'Already registered with this invite code' });
    }

    // Record the registration
    await db.insert(inviteRegistrations).values({
      inviteCodeId,
      userId,
    });

    // Increment the used count
    await db
      .update(inviteCodes)
      .set({ usedCount: inviteCode.usedCount + 1 })
      .where(eq(inviteCodes.id, inviteCodeId));

    res.json({ success: true, message: 'Invite code used successfully' });
  } catch (error) {
    console.error('Error using invite code:', error);
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

// Create invite code (temporarily not requiring admin for bootstrapping)
router.post('/admin/codes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { code, expiresAt, maxUses } = req.body;
    const userId = req.user!.id;

    if (!code) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    // Check if code already exists
    const [existingCode] = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.code, code));

    if (existingCode) {
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

    res.json(newCode);
  } catch (error) {
    console.error('Error creating invite code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin endpoints
router.use(requireAuth); // First authenticate
router.use(requireAdmin); // Then check admin access

// Get all invite codes
router.get('/admin/codes', async (req: AuthenticatedRequest, res: Response) => {
  try {
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
router.patch('/admin/codes/:id/deactivate', async (req: AuthenticatedRequest, res: Response) => {
  try {
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
router.get('/admin/requests', async (req: AuthenticatedRequest, res: Response) => {
  try {
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
router.patch('/admin/requests/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
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
router.get('/admin/whitelist', async (req: AuthenticatedRequest, res: Response) => {
  try {
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
router.post('/admin/whitelist', async (req: AuthenticatedRequest, res: Response) => {
  try {
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
router.delete('/admin/whitelist/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
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