# Girls Got Game API - Mobile Development Communication Guide

This document provides a comprehensive overview of the API communication patterns for the Girls Got Game basketball training application. Use this guide to implement a mobile application that communicates with the existing backend infrastructure.

## Architecture Overview

### Backend Stack
- **Server**: Node.js with Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth with Google OAuth
- **Real-time**: Socket.io for WebSocket connections
- **File Storage**: Cloudflare R2 for media uploads
- **Monitoring**: Sentry for error tracking

### Base URL Structure
```
Development: http://localhost:3001/api
Production: https://api.girlsgotgame.app/api
```

## Authentication System

### OAuth Flow (Better Auth)
```
1. Initiate OAuth: POST /api/auth/sign-in/social
   Body: { provider: "google", callbackURL: "your-app-callback" }
   Returns: { url: "google-oauth-url" }

2. After OAuth completion, user is redirected with session cookies

3. Check session: GET /api/me
   Returns: { user: { id, email, name }, session: { ... } }
```

### Session Management
- **Authentication**: Session-based with HTTP-only cookies
- **Headers Required**: 
  - `Content-Type: application/json`
  - `credentials: include` (for cookie handling)
- **Unauthorized Response**: `401` with `{ error: "Authentication required" }`

## Core API Endpoints

### Authentication Endpoints

#### Check Current Session
```http
GET /api/me
Headers: credentials: include
Response: {
  user: { id: string, email: string, name: string },
  session: { id: string, expiresAt: string, ... }
}
```

#### Sign Out
```http
POST /api/auth/sign-out
Headers: credentials: include
Response: { success: true }
```

### Profile Management

#### Get Current User Profile
```http
GET /api/profiles/me
Headers: credentials: include
Response: {
  id: string,
  name: string,
  email: string,
  image: string | null,
  avatarUrl: string | null,
  totalPoints: number,
  role: "player" | "parent",
  childId: string | null,
  isOnboarded: boolean,
  isVerified: boolean,
  jerseyNumber: number | null,
  createdAt: string,
  updatedAt: string
}
```

#### Update Profile
```http
PATCH /api/profiles/me
Headers: credentials: include, Content-Type: application/json
Body: {
  name?: string,
  avatarUrl?: string,
  role?: "player" | "parent",
  childId?: string,
  isOnboarded?: boolean,
  jerseyNumber?: number
}
Response: Updated profile object
```

#### Get Leaderboard
```http
GET /api/profiles/leaderboard
Response: Array<{
  id: string,
  name: string,
  totalPoints: number,
  jerseyNumber: number | null,
  avatarUrl: string | null
}>
```

#### Get Profile by ID (Public)
```http
GET /api/profiles/{id}
Response: Public profile data (limited fields)
```

### Workout System

#### Get User's Workouts
```http
GET /api/workouts?limit=20&offset=0
Headers: credentials: include
Response: Array<{
  id: string,
  userId: string,
  exerciseType: "dribbling" | "shooting" | "conditioning",
  pointsEarned: number,
  durationMinutes: number,
  notes: string | null,
  createdAt: string
}>
```

#### Create Workout
```http
POST /api/workouts
Headers: credentials: include, Content-Type: application/json
Body: {
  exerciseType: "dribbling" | "shooting" | "conditioning",
  pointsEarned: number,
  durationMinutes: number,
  notes?: string
}
Response: Created workout object
```

#### Get Workout Stats
```http
GET /api/workouts/stats/summary
Headers: credentials: include
Response: {
  totalWorkouts: number,
  totalPoints: number,
  totalMinutes: number,
  byType: {
    dribbling: number,
    shooting: number,
    conditioning: number
  }
}
```

#### Delete Workout
```http
DELETE /api/workouts/{id}
Headers: credentials: include
Response: 204 No Content
```

### Social Feed System

#### Get Feed Posts
```http
GET /api/posts/feed?limit=20&offset=0
Response: Array<{
  id: string,
  userId: string,
  content: string,
  imageUrl: string | null,
  workoutId: string | null,
  createdAt: string,
  user: { id, name, avatarUrl, jerseyNumber },
  workout: workout_object | null,
  likes: Array<{ userId: string }>,
  comments: Array<comment_objects>,
  likesCount: number,
  commentsCount: number,
  userHasLiked: boolean
}>
```

#### Create Post
```http
POST /api/posts
Headers: credentials: include, Content-Type: application/json
Body: {
  content: string,
  imageUrl?: string,
  workoutId?: string
}
Response: Created post with relations
```

#### Toggle Like
```http
POST /api/posts/{postId}/like
Headers: credentials: include
Response: { liked: boolean }
```

#### Add Comment
```http
POST /api/posts/{postId}/comments
Headers: credentials: include, Content-Type: application/json
Body: { content: string }
Response: Created comment with user data
```

#### Get Comments
```http
GET /api/posts/{postId}/comments?limit=20&offset=0
Response: Array<comment_objects_with_user_data>
```

### File Upload System

#### Upload Single File
```http
POST /api/upload/single
Headers: credentials: include
Body: FormData with 'file' field
Response: {
  url: string,
  name: string,
  size: number,
  type: string
}
```

#### Upload Avatar
```http
POST /api/upload/avatar
Headers: credentials: include
Body: FormData with 'file' field (16MB limit)
Response: Same as single upload
```

#### Upload Media for Posts
```http
POST /api/upload/media
Headers: credentials: include
Body: FormData with 'file' field (128MB limit)
Response: Same as single upload
```

**Supported File Types**: 
- Images: JPEG, JPG, PNG, GIF, WebP
- Videos: MP4, QuickTime, AVI, MKV

### Chat System

#### Get User Teams
```http
GET /api/chat/teams
Headers: credentials: include
Response: Array<{
  id: string,
  name: string,
  description: string | null,
  createdBy: string,
  createdAt: string,
  role: "admin" | "member"
}>
```

#### Create Team
```http
POST /api/chat/teams
Headers: credentials: include, Content-Type: application/json
Body: { name: string, description?: string }
Response: Created team object
```

#### Get Team Messages
```http
GET /api/chat/teams/{teamId}/messages
Headers: credentials: include
Response: Array<{
  id: string,
  content: string,
  messageType: "text" | "image" | "system",
  createdAt: string,
  senderId: string,
  senderName: string,
  senderAvatar: string | null
}>
```

#### Get DM History
```http
GET /api/chat/messages/dm/{otherUserId}
Headers: credentials: include
Response: Array of message objects
```

#### Get DM Conversations
```http
GET /api/chat/conversations
Headers: credentials: include
Response: Array<{
  id: string,
  name: string,
  email: string,
  avatarUrl: string | null,
  lastMessageContent: string,
  lastMessageSenderName: string,
  lastMessageTime: string
}>
```

#### Search Users
```http
GET /api/chat/users/search?q={query}
Headers: credentials: include
Response: Array<{ id, name, email, avatarUrl }>
```

### Invite System

#### Validate Invite Code
```http
POST /api/invites/validate
Body: { code: string }
Response: { valid: boolean, inviteCodeId?: string }
```

#### Use Invite Code (After OAuth)
```http
POST /api/invites/use
Headers: credentials: include, Content-Type: application/json
Body: { inviteCodeId: string }
Response: { 
  success: boolean, 
  message: string,
  updatedProfile: profile_object
}
```

## Real-time Communication (Socket.io)

### Connection Setup
```javascript
const socket = io('ws://localhost:3001', {
  withCredentials: true, // Important for auth
  transports: ['websocket', 'polling'],
  timeout: 10000
});
```

### Authentication
- **Method**: Session cookies (automatic with `withCredentials: true`)
- **Authentication Error**: Socket emits 'error' event with auth failure message

### Socket Event Patterns

#### Connection Events
```javascript
socket.on('connect', () => {
  // Connected successfully
});

socket.on('disconnect', (reason) => {
  // Disconnected - reason provided
});

socket.on('connect_error', (error) => {
  // Connection failed
});
```

#### Team Chat
```javascript
// Join team room
socket.emit('join_team', teamId);

// Send team message
socket.emit('team_message', {
  teamId: string,
  content: string
});

// Receive team messages
socket.on('team_message', (message) => {
  // Handle incoming team message
});

// Leave team room
socket.emit('leave_team', teamId);
```

#### Direct Messages
```javascript
// Send DM
socket.emit('direct_message', {
  recipientId: string,
  content: string
});

// Receive DMs
socket.on('direct_message', (message) => {
  // Handle incoming DM
});
```

#### Typing Indicators
```javascript
// Start typing
socket.emit('typing_start', {
  teamId?: string,
  recipientId?: string
});

// Stop typing
socket.emit('typing_stop', {
  teamId?: string,
  recipientId?: string
});

// Receive typing events
socket.on('user_typing', ({ userId, userName, teamId?, recipientId? }) => {
  // Show typing indicator
});

socket.on('user_stop_typing', ({ userId, teamId?, recipientId? }) => {
  // Hide typing indicator
});
```

#### Feed Updates
```javascript
// Real-time post updates
socket.on('post_created', (post) => {
  // New post added to feed
});

socket.on('post_updated', (post) => {
  // Post was edited
});

socket.on('post_deleted', (postId) => {
  // Post was removed
});
```

## Error Handling Patterns

### HTTP Error Responses
```json
{
  "error": "Error message description"
}
```

### Common Status Codes
- `200`: Success
- `201`: Created
- `204`: No Content (for deletes)
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (auth required)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

### Socket Error Events
```javascript
socket.on('error', (error) => {
  // Handle socket-specific errors
  if (error.message.includes('Authentication')) {
    // Redirect to login
  }
});
```

## Data Models

### User Profile
```typescript
interface User {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  image: string | null;
  avatarUrl: string | null;
  totalPoints: number;
  role: 'parent' | 'player';
  childId: string | null;
  isOnboarded: boolean;
  isVerified: boolean;
  jerseyNumber: number | null;
  createdAt: string;
  updatedAt: string;
}
```

### Workout
```typescript
interface Workout {
  id: string;
  userId: string;
  exerciseType: 'dribbling' | 'shooting' | 'conditioning';
  pointsEarned: number;
  durationMinutes: number;
  notes: string | null;
  createdAt: string;
}
```

### Post
```typescript
interface Post {
  id: string;
  userId: string;
  content: string;
  imageUrl: string | null;
  workoutId: string | null;
  createdAt: string;
  user?: User;
  workout?: Workout;
  likes?: Like[];
  comments?: Comment[];
}
```

### Chat Message
```typescript
interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  teamId?: string | null;
  recipientId?: string | null;
  content: string;
  messageType: 'text' | 'image' | 'system';
  createdAt: string;
}
```

## Implementation Guidelines for Mobile

### Authentication Flow
1. **OAuth Initiation**: Call `/api/auth/sign-in/social` with Google provider
2. **Web Browser**: Open returned URL in WebView or system browser
3. **Callback Handling**: Handle redirect after OAuth completion
4. **Session Verification**: Call `/api/me` to confirm authentication
5. **Profile Loading**: Call `/api/profiles/me` to get user profile

### API Client Setup
```typescript
class ApiClient {
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  async request<T>(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Critical for session cookies
      ...options,
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    return response.json() as Promise<T>;
  }
}
```

### Socket.io Integration
```typescript
import { io, Socket } from 'socket.io-client';

const initializeSocket = (userId: string): Socket => {
  const socket = io(API_BASE_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    timeout: 10000,
  });
  
  socket.on('connect', () => {
    console.log('Connected to server');
    // Auto-join user's personal room
    socket.emit('join_user_room', userId);
  });
  
  return socket;
};
```

### File Upload Helper
```typescript
const uploadFile = async (file: File, endpoint: string) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_BASE_URL}/upload/${endpoint}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    // Don't set Content-Type - let browser set it with boundary
  });
  
  if (!response.ok) {
    throw new Error('Upload failed');
  }
  
  return response.json();
};
```

## Security Considerations

### Authentication
- Session cookies are HTTP-only and secure
- CORS is configured for specific origins
- All authenticated endpoints require valid session

### Data Validation
- Server-side validation using Zod schemas
- File type restrictions on uploads
- SQL injection protection via Drizzle ORM

### Rate Limiting
- Consider implementing client-side rate limiting for API calls
- Be mindful of Socket.io connection limits

## Development Tips

1. **Environment Configuration**: Use different base URLs for development/production
2. **Error Boundaries**: Implement comprehensive error handling for network failures
3. **Offline Support**: Consider caching strategies for critical data
4. **Real-time Sync**: Use Socket.io events to keep data synchronized
5. **File Management**: Implement proper image/video compression before upload
6. **Testing**: Test thoroughly with network interruptions and auth expiration

This guide provides the foundation for implementing a mobile application that seamlessly integrates with the Girls Got Game backend infrastructure.