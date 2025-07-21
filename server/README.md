# Girls Got Game - Backend Server

Express.js backend server for the Girls Got Game basketball training app, featuring Drizzle ORM with PostgreSQL and Better Auth with Google OAuth.

## Features

- **Authentication**: Better Auth with Google OAuth integration
- **Database**: PostgreSQL with Drizzle ORM
- **API Routes**: RESTful endpoints for profiles, workouts, and posts
- **Type Safety**: Full TypeScript implementation with Zod validation
- **Security**: Helmet, CORS, and proper authentication middleware

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Fill in your environment variables:
   - `DATABASE_URL`: PostgreSQL connection string
   - `BETTER_AUTH_SECRET`: Random secret for auth
   - `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: From Google Cloud Console

3. **Generate and run database migrations:**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication
- `POST /api/auth/sign-in/social` - Google OAuth sign-in
- `GET /api/me` - Get current session

### Profiles
- `GET /api/profiles/me` - Get current user profile
- `POST /api/profiles` - Create profile
- `PATCH /api/profiles/me` - Update profile
- `GET /api/profiles/leaderboard` - Get points leaderboard
- `GET /api/profiles/:id` - Get public profile

### Workouts
- `GET /api/workouts` - Get user workouts
- `POST /api/workouts` - Create workout
- `GET /api/workouts/:id` - Get specific workout
- `DELETE /api/workouts/:id` - Delete workout
- `GET /api/workouts/stats/summary` - Get workout statistics

### Posts & Social
- `GET /api/posts/feed` - Get social feed
- `POST /api/posts` - Create post
- `PATCH /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/like` - Like/unlike post
- `POST /api/posts/:id/comments` - Add comment
- `GET /api/posts/:id/comments` - Get comments
- `DELETE /api/posts/comments/:id` - Delete comment

## Database Schema

The database includes the following tables:
- `profiles` - User profiles with roles and points
- `workouts` - Exercise sessions with types and duration
- `posts` - Social feed content
- `likes` - Post likes
- `comments` - Post comments

## Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Drizzle Studio

## File Upload Endpoints

### Images (Cloudflare Images - Optimized)
- `POST /api/upload/image` - Upload image with automatic optimization
- `DELETE /api/upload/image/:imageId` - Delete optimized image

### Files/Videos (Cloudflare R2 - Raw Storage)  
- `POST /api/upload/file` - Upload any file to R2
- `POST /api/upload/presigned-url` - Get presigned URL for direct upload
- `DELETE /api/upload/file/:key` - Delete file from R2

## Setup Guides

- **Cloudflare Setup**: See [CLOUDFLARE_SETUP.md](./CLOUDFLARE_SETUP.md) for detailed R2 and Images configuration
- **Google OAuth Setup**: 
  1. Go to [Google Cloud Console](https://console.cloud.google.com/)
  2. Create OAuth 2.0 credentials
  3. Add redirect URI: `http://localhost:3001/api/auth/callback/google`

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@localhost:5432/db` |
| `BETTER_AUTH_SECRET` | Auth secret key | `your-secret-key` |
| `BETTER_AUTH_URL` | Base URL | `http://localhost:3001` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `your-client-id` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | `your-client-secret` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID | `your-account-id` |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 access key | `your-r2-key` |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 secret key | `your-r2-secret` |
| `CLOUDFLARE_R2_BUCKET_NAME` | R2 bucket name | `girlsgotgame-uploads` |
| `CLOUDFLARE_IMAGES_API_TOKEN` | Images API token | `your-images-token` |
| `CLOUDFLARE_IMAGES_HASH` | Images delivery hash | `your-images-hash` |