import { Router } from 'express';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_DOMAIN } from '../config/r2';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { auth } from '../config/auth';
import { db } from '../db/index';
import { mediaUploads } from '../db/schema';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 128 * 1024 * 1024, // 128MB max
  },
  fileFilter: (req, file, cb) => {
    // Allow images and videos
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and videos are allowed.'));
    }
  },
});

// Helper function to generate unique filename
const generateFileName = (originalName: string): string => {
  const ext = path.extname(originalName);
  const name = path.basename(originalName, ext);
  const timestamp = Date.now();
  const uniqueId = uuidv4().substring(0, 8);
  return `${name}-${timestamp}-${uniqueId}${ext}`;
};

// Note: Using common auth middleware imported above - no custom auth needed

// Helper function to get image dimensions
const getImageDimensions = async (buffer: Buffer): Promise<{ width: number; height: number }> => {
  try {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  } catch (error) {
    console.warn('Failed to get image dimensions:', error);
    return { width: 0, height: 0 };
  }
};

// Helper to save media record to database
const saveMediaRecord = async (
  userId: string,
  file: Express.Multer.File,
  fileName: string,
  uploadUrl: string,
  dimensions?: { width: number; height: number }
) => {
  try {
    const isVideo = file.mimetype.startsWith('video/');
    const isImage = file.mimetype.startsWith('image/');

    let width: number | undefined;
    let height: number | undefined;

    if (isImage && dimensions) {
      width = dimensions.width;
      height = dimensions.height;
    }

    const [mediaRecord] = await db
      .insert(mediaUploads)
      .values({
        uploadedBy: userId,
        fileName,
        originalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        mediaType: isVideo ? 'video' : 'image',
        uploadUrl,
        width,
        height,
        tags: JSON.stringify([]),
        isVisible: true,
      })
      .returning();

    return mediaRecord;
  } catch (error) {
    console.warn('Failed to save media record:', error);
    // Don't fail the upload if we can't save the record
    return null;
  }
};

// Upload single file
router.post('/single', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const fileName = generateFileName(req.file.originalname);
    const contentType = req.file.mimetype;

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: contentType,
    });

    await r2Client.send(command);

    // Construct public URL
    const url = `https://${R2_PUBLIC_DOMAIN}/${fileName}`;

    res.json({
      url,
      name: fileName,
      size: req.file.size,
      type: contentType,
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Upload avatar (with size limit)
router.post('/avatar', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Check file size for avatars (16MB limit)
    if (req.file.size > 16 * 1024 * 1024) {
      return res.status(400).json({ error: 'Avatar file too large. Maximum size is 16MB.' });
    }

    const fileName = `avatars/${generateFileName(req.file.originalname)}`;
    const contentType = req.file.mimetype;

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: contentType,
    });

    await r2Client.send(command);

    // Construct public URL
    const url = `https://${R2_PUBLIC_DOMAIN}/${fileName}`;

    res.json({
      url,
      name: fileName,
      size: req.file.size,
      type: contentType,
    });
  } catch (error) {
    console.error('❌ Avatar upload error:', error);
    res.status(500).json({ 
      error: 'Avatar upload failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Upload media for feed posts
router.post('/media', requireAuth, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const fileName = `media/${generateFileName(req.file.originalname)}`;
    const contentType = req.file.mimetype;

    // Get image dimensions for images
    let dimensions;
    if (req.file.mimetype.startsWith('image/')) {
      dimensions = await getImageDimensions(req.file.buffer);
    }

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: contentType,
    });

    await r2Client.send(command);

    // Construct public URL
    const url = `https://${R2_PUBLIC_DOMAIN}/${fileName}`;

    console.log('📹 Media uploaded to R2:', url);

    // Save media record to database for tracking in media gallery
    const mediaRecord = await saveMediaRecord(req.user.id, req.file, fileName, url, dimensions);

    res.json({
      url,
      name: fileName,
      size: req.file.size,
      type: contentType,
      mediaId: mediaRecord?.id, // Include media ID for reference
    });
  } catch (error) {
    console.error('❌ Media upload error:', error);
    res.status(500).json({ 
      error: 'Media upload failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

export default router;