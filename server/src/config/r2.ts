import { S3Client } from '@aws-sdk/client-s3';

if (!process.env.CLOUDFLARE_R2_ACCESS_KEY_ID) {
  throw new Error('CLOUDFLARE_R2_ACCESS_KEY_ID is not set');
}

if (!process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
  throw new Error('CLOUDFLARE_R2_SECRET_ACCESS_KEY is not set');
}

if (!process.env.CLOUDFLARE_ACCOUNT_ID) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID is not set');
}

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

export const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'girlsgotgame';
export const R2_PUBLIC_DOMAIN = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || 'pub-1fc550d0d7dc4f5dab7e4d9f85a178ad.r2.dev';