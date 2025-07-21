import { Router } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { user, accessRequests, emailWhitelist, bannedEmails } from '../db/schema';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { EmailService } from '../lib/email';

const router = Router();

// Submit access request (no auth required)
router.post('/', async (req, res) => {
  try {
    const { email, name, message } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email is banned
    const bannedEmail = await db.query.bannedEmails.findFirst({
      where: eq(bannedEmails.email, normalizedEmail)
    });

    if (bannedEmail) {
      return res.status(403).json({ error: 'This email address is not eligible for registration' });
    }

    // Check if user already exists
    const existingUser = await db.query.user.findFirst({
      where: eq(user.email, normalizedEmail)
    });

    if (existingUser) {
      return res.status(400).json({ error: 'An account already exists for this email' });
    }

    // Check if there's already a pending request
    const existingRequest = await db.query.accessRequests.findFirst({
      where: and(
        eq(accessRequests.email, normalizedEmail),
        eq(accessRequests.status, 'pending')
      )
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'A pending access request already exists for this email' });
    }

    // Check if there's already an approved request
    const approvedRequest = await db.query.accessRequests.findFirst({
      where: and(
        eq(accessRequests.email, normalizedEmail),
        eq(accessRequests.status, 'approved')
      )
    });

    if (approvedRequest) {
      return res.status(400).json({ error: 'Access has already been approved for this email' });
    }

    // Create the access request
    const [newRequest] = await db.insert(accessRequests).values({
      email: normalizedEmail,
      name: name?.trim() || null,
      message: message?.trim() || null,
      status: 'pending'
    }).returning();

    // Send email notifications
    const requestData = {
      id: newRequest.id,
      email: normalizedEmail,
      name: name?.trim(),
      message: message?.trim(),
      createdAt: newRequest.createdAt
    };

    // Send notification to admin (don't wait for it)
    EmailService.sendAccessRequestNotification(requestData).catch(error => {
      console.error('Failed to send admin notification:', error);
    });

    // Send confirmation to user (don't wait for it)
    EmailService.sendAccessRequestConfirmation(normalizedEmail, name?.trim()).catch(error => {
      console.error('Failed to send user confirmation:', error);
    });

    res.json({
      id: newRequest.id,
      message: 'Access request submitted successfully. You will be notified when it is reviewed.'
    });

  } catch (error) {
    console.error('Submit access request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's own access requests (authenticated)
router.get('/my-requests', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user!.email;

    const requests = await db.query.accessRequests.findMany({
      where: eq(accessRequests.email, userEmail),
      orderBy: [desc(accessRequests.createdAt)],
      with: {
        reviewer: {
          columns: {
            id: true,
            name: true
          }
        }
      }
    });

    const formattedRequests = requests.map(request => ({
      id: request.id,
      email: request.email,
      name: request.name,
      message: request.message,
      status: request.status,
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt,
      reviewer: request.reviewer ? {
        name: request.reviewer.name
      } : null
    }));

    res.json(formattedRequests);

  } catch (error) {
    console.error('Get my access requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get all access requests
router.get('/admin/all', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const userProfile = await db.query.user.findFirst({
      where: eq(user.id, req.user!.id)
    });

    if (!userProfile || userProfile.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status } = req.query;

    let whereCondition = undefined;
    if (status && typeof status === 'string') {
      whereCondition = eq(accessRequests.status, status as 'pending' | 'approved' | 'rejected');
    }

    const requests = await db.query.accessRequests.findMany({
      where: whereCondition,
      orderBy: [desc(accessRequests.createdAt)],
      with: {
        reviewer: {
          columns: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    const formattedRequests = requests.map(request => ({
      id: request.id,
      email: request.email,
      name: request.name,
      message: request.message,
      status: request.status,
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt,
      reviewer: request.reviewer ? {
        id: request.reviewer.id,
        name: request.reviewer.name || request.reviewer.email,
        email: request.reviewer.email
      } : null
    }));

    res.json(formattedRequests);

  } catch (error) {
    console.error('Admin get all access requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Approve access request
router.post('/admin/:requestId/approve', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const userProfile = await db.query.user.findFirst({
      where: eq(user.id, req.user!.id)
    });

    if (!userProfile || userProfile.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { requestId } = req.params;
    const { addToWhitelist = true } = req.body;

    // Find the access request
    const request = await db.query.accessRequests.findFirst({
      where: eq(accessRequests.id, requestId)
    });

    if (!request) {
      return res.status(404).json({ error: 'Access request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request has already been reviewed' });
    }

    // Update the request status
    await db.update(accessRequests)
      .set({
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: req.user!.id
      })
      .where(eq(accessRequests.id, requestId));

    // Add to whitelist if requested
    if (addToWhitelist) {
      const existingWhitelist = await db.query.emailWhitelist.findFirst({
        where: eq(emailWhitelist.email, request.email)
      });

      if (!existingWhitelist) {
        await db.insert(emailWhitelist).values({
          email: request.email,
          addedBy: req.user!.id
        });
      }
    }

    // Get reviewer name for email
    const reviewerName = userProfile.name || userProfile.email;

    // Send approval email to user
    EmailService.sendAccessRequestDecision({
      email: request.email,
      name: request.name || undefined,
      approved: true,
      reviewerName
    }).catch(error => {
      console.error('Failed to send approval email:', error);
    });

    res.json({ 
      message: 'Access request approved successfully',
      addedToWhitelist 
    });

  } catch (error) {
    console.error('Approve access request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Reject access request
router.post('/admin/:requestId/reject', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const userProfile = await db.query.user.findFirst({
      where: eq(user.id, req.user!.id)
    });

    if (!userProfile || userProfile.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { requestId } = req.params;
    const { reason } = req.body;

    // Find the access request
    const request = await db.query.accessRequests.findFirst({
      where: eq(accessRequests.id, requestId)
    });

    if (!request) {
      return res.status(404).json({ error: 'Access request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request has already been reviewed' });
    }

    // Update the request status
    await db.update(accessRequests)
      .set({
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: req.user!.id
      })
      .where(eq(accessRequests.id, requestId));

    // Get reviewer name for email
    const reviewerName = userProfile.name || userProfile.email;

    // Send rejection email to user
    EmailService.sendAccessRequestDecision({
      email: request.email,
      name: request.name || undefined,
      approved: false,
      reviewerName
    }).catch(error => {
      console.error('Failed to send rejection email:', error);
    });

    res.json({ message: 'Access request rejected' });

  } catch (error) {
    console.error('Reject access request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get access request statistics
router.get('/admin/stats', requireAuth, async (req, res) => {
  try {
    // Check if user is admin
    const userProfile = await db.query.user.findFirst({
      where: eq(user.id, req.user!.id)
    });

    if (!userProfile || userProfile.email !== 'codydearkland@gmail.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const [pendingCount] = await db
      .select({ count: eq(accessRequests.status, 'pending') })
      .from(accessRequests);

    const [approvedCount] = await db
      .select({ count: eq(accessRequests.status, 'approved') })
      .from(accessRequests);

    const [rejectedCount] = await db
      .select({ count: eq(accessRequests.status, 'rejected') })
      .from(accessRequests);

    res.json({
      pending: pendingCount?.count || 0,
      approved: approvedCount?.count || 0,
      rejected: rejectedCount?.count || 0
    });

  } catch (error) {
    console.error('Get access request stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;