import { Router } from 'express';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET_NAME, R2_PUBLIC_DOMAIN } from '../config/r2';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

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

    console.log('📸 File uploaded to R2:', url);

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

    console.log('🖼️ Avatar uploaded to R2:', url);

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
router.post('/media', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const fileName = `media/${generateFileName(req.file.originalname)}`;
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

    console.log('📹 Media uploaded to R2:', url);

    res.json({
      url,
      name: fileName,
      size: req.file.size,
      type: contentType,
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