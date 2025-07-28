# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start the Vite development server
- `npm run build` - Build the application for production
- `npm run lint` - Run ESLint to check code quality
- `npm run preview` - Preview the production build locally

## Project Architecture

This is a React TypeScript basketball training app called "Girls Got Game" built with:

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + PostCSS
- **Backend**: Node.js API server with Better Auth
- **Real-time**: WebSocket connections via Socket.io
- **Routing**: React Router DOM v7
- **State Management**: React hooks + API client
- **Animations**: Framer Motion
- **Notifications**: React Hot Toast
- **Icons**: Lucide React

### Application Structure

The app uses a tab-based navigation system with different screens:
- **Feed Screen**: Social feed for sharing workouts and posts
- **Training Screen**: Exercise tracking with predefined templates
- **Leaderboard Screen**: Points-based ranking system
- **Profile Screen**: User profile management
- **Admin Screen**: Administrative functions
- **Parent Dashboard**: For parent role users

### Authentication Flow
- Google OAuth authentication via Better Auth
- Automatic profile creation for new users
- Role-based access (player/parent)
- Onboarding flow for new users
- Session persistence and token refresh handling

### Database Schema
Three main tables in the database:
- `profiles`: User data with roles, points, onboarding status
- `workouts`: Exercise sessions with type, duration, points
- `posts`: Social feed content linked to workouts

### Key Components
- `useAuth` hook: Centralized authentication and profile management
- API client: Centralized HTTP client for backend communication
- Socket.io client: Real-time WebSocket connections
- Exercise templates: Predefined workouts in `src/data/exercises.ts`
- Navigation: Responsive sidebar/bottom nav based on screen size
- Screen components: Feature-specific UI components

### Environment Variables Required
- `VITE_API_URL`: Backend API server URL (optional, defaults to localhost:3001 in dev)

### File Organization
- `/src/components/`: Screen components (AuthScreen, FeedScreen, etc.)
- `/src/hooks/`: Custom React hooks (useAuth)
- `/src/lib/`: External service integrations (API client, Socket.io)
- `/src/types/`: TypeScript interfaces
- `/src/data/`: Static data (exercise templates)
- `/server/`: Node.js backend API server

this is a test
