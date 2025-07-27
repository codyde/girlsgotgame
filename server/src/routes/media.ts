import express from 'express';
import multer from 'multer';
import { auth } from '../config/auth';
import { db } from '../db/index';
import { mediaUploads, user } from '../db/schema';
import { eq, desc, and, like, isNull, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webm|mkv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and videos are allowed.'));
    }
  },
});

// Authentication middleware
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.user?.email !== 'codydearkland@gmail.com') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Helper function to save file (simulate cloud storage)
const saveFile = async (buffer: Buffer, filename: string): Promise<string> => {
  // In production, this would upload to cloud storage (R2, S3, etc.)
  // For now, save to local uploads directory
  const uploadsDir = path.join(process.cwd(), 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });
  
  const filePath = path.join(uploadsDir, filename);
  await fs.writeFile(filePath, buffer);
  
  // Return URL - in production this would be the cloud storage URL
  return `/uploads/${filename}`;
};

// Helper function to get image dimensions
const getImageDimensions = async (buffer: Buffer): Promise<{ width: number; height: number }> => {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
};

// Helper function to get video metadata
const getVideoMetadata = async (filePath: string): Promise<{ width?: number; height?: number; duration?: number }> => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
      resolve({
        width: videoStream?.width,
        height: videoStream?.height,
        duration: metadata.format.duration ? Math.round(metadata.format.duration) : undefined,
      });
    });
  });
};

// Helper function to generate video thumbnail
const generateVideoThumbnail = async (videoPath: string, outputPath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['10%'],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '320x240'
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
};

// GET /api/media - Get all media items
router.get('/', requireAuth, async (req, res) => {
  try {
    const { type, tags, includeHidden } = req.query;
    const isAdmin = req.user?.email === 'codydearkland@gmail.com';

    let query = db
      .select({
        id: mediaUploads.id,
        uploadedBy: mediaUploads.uploadedBy,
        uploaderName: user.name,
        fileName: mediaUploads.fileName,
        originalName: mediaUploads.originalName,
        fileSize: mediaUploads.fileSize,
        mimeType: mediaUploads.mimeType,
        mediaType: mediaUploads.mediaType,
        uploadUrl: mediaUploads.uploadUrl,
        thumbnailUrl: mediaUploads.thumbnailUrl,
        width: mediaUploads.width,
        height: mediaUploads.height,
        duration: mediaUploads.duration,
        tags: mediaUploads.tags,
        description: mediaUploads.description,
        isVisible: mediaUploads.isVisible,
        createdAt: mediaUploads.createdAt,
        updatedAt: mediaUploads.updatedAt,
      })
      .from(mediaUploads)
      .leftJoin(user, eq(mediaUploads.uploadedBy, user.id))
      .orderBy(desc(mediaUploads.createdAt));

    // Apply filters
    const conditions = [];

    // Type filter
    if (type && (type === 'image' || type === 'video')) {
      conditions.push(eq(mediaUploads.mediaType, type as string));
    }

    // Tags filter
    if (tags && typeof tags === 'string' && tags.trim()) {
      conditions.push(like(mediaUploads.tags, `%${tags.trim()}%`));
    }

    // Visibility filter (non-admins only see visible content)
    if (!isAdmin || includeHidden !== 'true') {
      conditions.push(eq(mediaUploads.isVisible, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const items = await query;

    // Parse tags from JSON strings
    const formattedItems = items.map(item => ({
      ...item,
      tags: item.tags ? JSON.parse(item.tags) : [],
    }));

    res.json(formattedItems);
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Failed to fetch media items' });
  }
});

// POST /api/media/upload - Upload new media
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const file = req.file;
    const fileId = uuidv4();
    const fileExtension = path.extname(file.originalname);
    const fileName = `${fileId}${fileExtension}`;
    const isVideo = file.mimetype.startsWith('video/');
    const isImage = file.mimetype.startsWith('image/');

    // Save the main file
    const uploadUrl = await saveFile(file.buffer, fileName);

    let width: number | undefined;
    let height: number | undefined;
    let duration: number | undefined;
    let thumbnailUrl: string | undefined;

    if (isImage) {
      // Get image dimensions
      const dimensions = await getImageDimensions(file.buffer);
      width = dimensions.width;
      height = dimensions.height;
    } else if (isVideo) {
      // For videos, we need to save the file first to get metadata
      const tempVideoPath = path.join(process.cwd(), 'uploads', fileName);
      
      try {
        // Get video metadata
        const metadata = await getVideoMetadata(tempVideoPath);
        width = metadata.width;
        height = metadata.height;
        duration = metadata.duration;

        // Generate thumbnail
        const thumbnailFileName = `thumb_${fileId}.jpg`;
        const thumbnailPath = path.join(process.cwd(), 'uploads', thumbnailFileName);
        await generateVideoThumbnail(tempVideoPath, thumbnailPath);
        thumbnailUrl = `/uploads/${thumbnailFileName}`;
      } catch (videoError) {
        console.warn('Failed to process video metadata/thumbnail:', videoError);
        // Continue without metadata/thumbnail
      }
    }

    // Save to database
    const [newMedia] = await db
      .insert(mediaUploads)
      .values({
        uploadedBy: req.user!.id,
        fileName,
        originalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        mediaType: isVideo ? 'video' : 'image',
        uploadUrl,
        thumbnailUrl,
        width,
        height,
        duration,
        tags: JSON.stringify([]),
        isVisible: true,
      })
      .returning();

    res.status(201).json({
      ...newMedia,
      tags: [],
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// PATCH /api/media/:id - Update media item (admin only)
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { tags, description, isVisible } = req.body;

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (tags !== undefined) {
      updateData.tags = JSON.stringify(Array.isArray(tags) ? tags : []);
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    if (isVisible !== undefined) {
      updateData.isVisible = Boolean(isVisible);
    }

    const [updatedMedia] = await db
      .update(mediaUploads)
      .set(updateData)
      .where(eq(mediaUploads.id, id))
      .returning();

    if (!updatedMedia) {
      return res.status(404).json({ error: 'Media item not found' });
    }

    res.json({
      ...updatedMedia,
      tags: updatedMedia.tags ? JSON.parse(updatedMedia.tags) : [],
    });
  } catch (error) {
    console.error('Error updating media:', error);
    res.status(500).json({ error: 'Failed to update media item' });
  }
});

// DELETE /api/media/:id - Delete media item (owner or admin)
router.delete('/:id', requireAuth, async (req: any, res) => {
  try {
    const { id } = req.params;

    // Get the media item first to get file paths
    const [mediaItem] = await db
      .select()
      .from(mediaUploads)
      .where(eq(mediaUploads.id, id))
      .limit(1);

    if (!mediaItem) {
      return res.status(404).json({ error: 'Media item not found' });
    }

    // Check permissions: user owns the media OR user is admin
    const isAdmin = req.user?.email === 'codydearkland@gmail.com';
    const isOwner = mediaItem.uploadedBy === req.user?.id;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this media' });
    }

    // Delete files from storage
    try {
      const mainFilePath = path.join(process.cwd(), 'uploads', mediaItem.fileName);
      await fs.unlink(mainFilePath);

      if (mediaItem.thumbnailUrl) {
        const thumbnailFileName = path.basename(mediaItem.thumbnailUrl);
        const thumbnailPath = path.join(process.cwd(), 'uploads', thumbnailFileName);
        await fs.unlink(thumbnailPath);
      }
    } catch (fileError) {
      console.warn('Failed to delete files:', fileError);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await db.delete(mediaUploads).where(eq(mediaUploads.id, id));

    res.json({ message: 'Media item deleted successfully' });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ error: 'Failed to delete media item' });
  }
});

// Serve uploaded files
router.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(process.cwd(), 'uploads', filename);
  
  // Basic security check
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving file:', err);
      res.status(404).json({ error: 'File not found' });
    }
  });
});

export default router;