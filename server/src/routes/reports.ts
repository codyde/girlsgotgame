import express from 'express';
import { auth } from '../config/auth';
import { db } from '../db/index';
import { reports, posts, mediaUploads, user } from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';

const router = express.Router();

// Authentication middleware
const requireAuth = async (req: any, res: any, next: any) => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as any,
    });

    if (!session?.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    req.user = session.user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Admin check middleware
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.email !== 'codydearkland@gmail.com') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// POST /api/reports - Create a new report
router.post('/', requireAuth, async (req: any, res) => {
  try {
    const { reportType, reportedItemId, reason } = req.body;

    if (!reportType || !reportedItemId || !reason?.trim()) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['post', 'media'].includes(reportType)) {
      return res.status(400).json({ error: 'Invalid report type' });
    }

    // Check if the reported item exists
    if (reportType === 'post') {
      const [existingPost] = await db
        .select()
        .from(posts)
        .where(eq(posts.id, reportedItemId))
        .limit(1);

      if (!existingPost) {
        return res.status(404).json({ error: 'Post not found' });
      }
    } else if (reportType === 'media') {
      const [existingMedia] = await db
        .select()
        .from(mediaUploads)
        .where(eq(mediaUploads.id, reportedItemId))
        .limit(1);

      if (!existingMedia) {
        return res.status(404).json({ error: 'Media not found' });
      }
    }

    // Check if user has already reported this item
    const [existingReport] = await db
      .select()
      .from(reports)
      .where(and(
        eq(reports.reportedBy, req.user.id),
        eq(reports.reportedItemId, reportedItemId),
        eq(reports.reportType, reportType)
      ))
      .limit(1);

    if (existingReport) {
      return res.status(400).json({ error: 'You have already reported this content' });
    }

    const [newReport] = await db
      .insert(reports)
      .values({
        reportedBy: req.user.id,
        reportType,
        reportedItemId,
        reason: reason.trim(),
        status: 'pending'
      })
      .returning();

    res.status(201).json(newReport);
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Failed to create report' });
  }
});

// GET /api/reports - Get all reports (admin only)
router.get('/', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { status = 'pending', limit = 50, offset = 0 } = req.query;

    let query = db
      .select({
        id: reports.id,
        reportedBy: reports.reportedBy,
        reporterName: user.name,
        reporterEmail: user.email,
        reportType: reports.reportType,
        reportedItemId: reports.reportedItemId,
        reason: reports.reason,
        status: reports.status,
        adminNotes: reports.adminNotes,
        resolvedBy: reports.resolvedBy,
        resolvedAt: reports.resolvedAt,
        createdAt: reports.createdAt,
        updatedAt: reports.updatedAt,
      })
      .from(reports)
      .leftJoin(user, eq(reports.reportedBy, user.id))
      .orderBy(desc(reports.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    if (status && status !== 'all') {
      query = query.where(eq(reports.status, status as string));
    }

    const reportsList = await query;

    // Fetch additional data for reported items
    const reportsWithDetails = await Promise.all(
      reportsList.map(async (report) => {
        let reportedItem = null;

        if (report.reportType === 'post') {
          const [post] = await db
            .select({
              id: posts.id,
              content: posts.content,
              imageUrl: posts.imageUrl,
              userId: posts.userId,
              userName: user.name,
              userEmail: user.email,
            })
            .from(posts)
            .leftJoin(user, eq(posts.userId, user.id))
            .where(eq(posts.id, report.reportedItemId))
            .limit(1);

          reportedItem = post;
        } else if (report.reportType === 'media') {
          const [media] = await db
            .select({
              id: mediaUploads.id,
              fileName: mediaUploads.fileName,
              originalName: mediaUploads.originalName,
              uploadUrl: mediaUploads.uploadUrl,
              mediaType: mediaUploads.mediaType,
              uploadedBy: mediaUploads.uploadedBy,
              uploaderName: user.name,
              uploaderEmail: user.email,
            })
            .from(mediaUploads)
            .leftJoin(user, eq(mediaUploads.uploadedBy, user.id))
            .where(eq(mediaUploads.id, report.reportedItemId))
            .limit(1);

          reportedItem = media;
        }

        return {
          ...report,
          reportedItem,
        };
      })
    );

    res.json(reportsWithDetails);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// PATCH /api/reports/:id - Update report status (admin only)
router.patch('/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!status || !['pending', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'resolved' || status === 'dismissed') {
      updateData.resolvedBy = req.user.id;
      updateData.resolvedAt = new Date();
    }

    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }

    const [updatedReport] = await db
      .update(reports)
      .set(updateData)
      .where(eq(reports.id, id))
      .returning();

    if (!updatedReport) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(updatedReport);
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// DELETE /api/reports/:id/content - Delete the reported content (admin only)
router.delete('/:id/content', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;

    // Get the report
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Delete the reported content
    if (report.reportType === 'post') {
      await db.delete(posts).where(eq(posts.id, report.reportedItemId));
    } else if (report.reportType === 'media') {
      await db.delete(mediaUploads).where(eq(mediaUploads.id, report.reportedItemId));
    }

    // Mark report as resolved
    await db
      .update(reports)
      .set({
        status: 'resolved',
        adminNotes: 'Content deleted by admin',
        resolvedBy: req.user.id,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reports.id, id));

    res.json({ message: 'Content deleted and report resolved' });
  } catch (error) {
    console.error('Error deleting reported content:', error);
    res.status(500).json({ error: 'Failed to delete content' });
  }
});

export default router;