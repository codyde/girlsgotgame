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
- **Backend**: Supabase (authentication, database, real-time)
- **Routing**: React Router DOM v7
- **State Management**: React hooks + Supabase client
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
- Magic link authentication via Supabase Auth
- Automatic profile creation for new users
- Role-based access (player/parent)
- Onboarding flow for new users
- Session persistence and token refresh handling

### Database Schema
Three main tables in Supabase:
- `profiles`: User data with roles, points, onboarding status
- `workouts`: Exercise sessions with type, duration, points
- `posts`: Social feed content linked to workouts

### Key Components
- `useAuth` hook: Centralized authentication and profile management
- Exercise templates: Predefined workouts in `src/data/exercises.ts`
- Navigation: Responsive sidebar/bottom nav based on screen size
- Screen components: Feature-specific UI components

### Environment Variables Required
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key

### File Organization
- `/src/components/`: Screen components (AuthScreen, FeedScreen, etc.)
- `/src/hooks/`: Custom React hooks (useAuth)
- `/src/lib/`: External service integrations (Supabase client)
- `/src/types/`: TypeScript interfaces
- `/src/data/`: Static data (exercise templates)
- `/supabase/migrations/`: Database migration files