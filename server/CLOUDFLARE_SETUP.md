# Cloudflare Setup Guide

This guide walks you through setting up Cloudflare R2 and Cloudflare Images for file uploads.

## 1. Create Cloudflare Account & Get Account ID

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Sign up or log in
3. Your **Account ID** is displayed on the right sidebar of the dashboard
   - Copy this for `CLOUDFLARE_ACCOUNT_ID`

## 2. Setup Cloudflare R2

### Enable R2
1. In Cloudflare Dashboard, go to **R2 Object Storage**
2. Click **"Purchase R2"** (free tier available)
3. Agree to terms

### Create R2 Bucket
1. Click **"Create bucket"**
2. Name: `girlsgotgame-uploads` (or your preferred name)
3. Location: Choose closest to your users
4. Click **"Create bucket"**

### Create R2 API Token
1. Go to **R2 Object Storage** → **Manage R2 API tokens**
2. Click **"Create API token"**
3. **Token name**: `girlsgotgame-server`
4. **Permissions**: 
   - Object Read
   - Object Write
   - Object Delete
5. **Specify bucket**: Select your bucket
6. Click **"Create API token"**
7. Copy the **Access Key ID** → `CLOUDFLARE_R2_ACCESS_KEY_ID`
8. Copy the **Secret Access Key** → `CLOUDFLARE_R2_SECRET_ACCESS_KEY`

### Setup Custom Domain (Optional but Recommended)
1. In your bucket settings, go to **"Settings"** → **"Custom Domains"**
2. Click **"Connect Domain"**
3. Enter your domain: `uploads.yourdomain.com`
4. Follow DNS setup instructions
5. Use this domain for `CLOUDFLARE_R2_CUSTOM_DOMAIN`

## 3. Setup Cloudflare Images

### Enable Cloudflare Images
1. In Cloudflare Dashboard, go to **Images**
2. Click **"Subscribe to Cloudflare Images"**
3. Choose plan (starts with 100k images/month free)

### Get Images Hash
1. In **Images** → **"Quick Start"**
2. Your **Account Hash** is shown in the delivery URL
3. URL format: `https://imagedelivery.net/{HASH}/{IMAGE_ID}/public`
4. Copy the `{HASH}` part for `CLOUDFLARE_IMAGES_HASH`

### Create Images API Token
1. Go to **"My Profile"** → **"API Tokens"**
2. Click **"Create Token"**
3. **Template**: Custom token
4. **Token name**: `girlsgotgame-images`
5. **Permissions**:
   - Account: `Cloudflare Images:Edit`
6. **Account Resources**: 
   - Include: Your account
7. Click **"Continue to summary"** → **"Create Token"**
8. Copy the token for `CLOUDFLARE_IMAGES_API_TOKEN`

## 4. Environment Variables Summary

Add these to your Railway environment variables:

```bash
# Required
CLOUDFLARE_ACCOUNT_ID=your-account-id-from-dashboard
CLOUDFLARE_R2_ACCESS_KEY_ID=your-r2-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-r2-secret-key  
CLOUDFLARE_R2_BUCKET_NAME=girlsgotgame-uploads
CLOUDFLARE_IMAGES_API_TOKEN=your-images-api-token
CLOUDFLARE_IMAGES_HASH=your-images-hash

# Optional
CLOUDFLARE_R2_CUSTOM_DOMAIN=uploads.yourdomain.com
```

## 5. Testing Your Setup

### Test R2 Upload
```bash
curl -X POST http://localhost:3001/api/upload/file \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@test-image.jpg"
```

### Test Images Upload  
```bash
curl -X POST http://localhost:3001/api/upload/image \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@test-image.jpg"
```

## 6. Usage in Your App

### For Images (automatic optimization):
```typescript
// Use /api/upload/image
// Images get automatically optimized and served via CDN
const imageUrl = "https://imagedelivery.net/{hash}/{id}/public"
```

### For Videos/Large Files:
```typescript  
// Use /api/upload/file or /api/upload/presigned-url
// Files stored in R2, served via custom domain or R2 URL
const videoUrl = "https://uploads.yourdomain.com/user123/video.mp4"
```

## 7. Cost Breakdown

### R2 (Free Tier)
- 10 GB storage/month
- 1 million Class A operations/month  
- 1 million Class B operations/month
- **No egress fees** (huge advantage!)

### Images (Free Tier)
- 100,000 images served/month
- Automatic optimization included

This setup gives you generous limits perfect for a growing basketball training app!