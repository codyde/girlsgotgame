# Invite-Only System Implementation Plan

## Overview
Transform the Girls Got Game application from open registration to an invite-only system with parent-controlled invites and admin moderation.

## Current System Analysis

### Authentication Flow
- Uses Better Auth with Google OAuth
- Automatic profile creation for new users
- Role-based system (parent/player)
- Onboarding flow for role selection

### Database Schema
- `profiles` table with user data, roles, points, onboarding status
- `workouts` table for exercise sessions  
- `posts` table for social feed content
- `teams` and related chat tables

### Key Components
- `AuthScreen.tsx` - handles Google sign-in
- `OnboardingScreen.tsx` - role selection and profile setup
- `useAuth.ts` - authentication hook
- `AdminScreen.tsx` - admin management interface
- `ParentDashboard.tsx` - parent features

## Implementation Plan

### Phase 1: Database Schema Extensions
**Files to modify:** `supabase/migrations/`

1. **Create invite system tables:**
   - `invite_codes` table for tracking invite links
     - `id` (uuid, primary key)
     - `code` (text, unique) - the actual invite code
     - `created_by` (uuid, references profiles.id) - parent who created it
     - `created_at` (timestamp)
     - `expires_at` (timestamp, optional)
     - `max_uses` (integer, default 1)
     - `used_count` (integer, default 0)
     - `is_active` (boolean, default true)

   - `invite_registrations` table for tracking usage
     - `id` (uuid, primary key)
     - `invite_code_id` (uuid, references invite_codes.id)
     - `user_id` (uuid, references profiles.id) - who signed up
     - `registered_at` (timestamp)

   - `access_requests` table for organic signups
     - `id` (uuid, primary key)
     - `email` (text)
     - `name` (text, optional)
     - `message` (text, optional)
     - `status` (text) - 'pending', 'approved', 'rejected'
     - `created_at` (timestamp)
     - `reviewed_at` (timestamp, optional)
     - `reviewed_by` (uuid, references profiles.id, optional)

   - `email_whitelist` table for pre-approved emails
     - `id` (uuid, primary key)
     - `email` (text, unique)
     - `added_by` (uuid, references profiles.id)
     - `added_at` (timestamp)

   - `banned_emails` table
     - `id` (uuid, primary key)
     - `email` (text, unique)
     - `banned_by` (uuid, references profiles.id)
     - `banned_at` (timestamp)
     - `reason` (text, optional)

### Phase 2: Authentication Flow Modifications
**Files to modify:** `src/components/AuthScreen.tsx`, `src/hooks/useAuth.ts`, `server/src/routes/auth.ts`

1. **Update AuthScreen.tsx:**
   - Add logic to check authentication eligibility before allowing sign-in
   - Show access request form for non-eligible users
   - Handle invite code validation from URL parameters

2. **Create new components:**
   - `AccessRequestForm.tsx` - form for requesting access
   - `InviteValidation.tsx` - validates invite codes from URL

3. **Update useAuth.ts:**
   - Add pre-authentication check function
   - Handle invite code validation
   - Add access request submission

### Phase 3: Backend API Extensions
**Files to modify:** `server/src/routes/`, `server/src/`

1. **Create new route files:**
   - `server/src/routes/invites.ts` - invite code management
   - `server/src/routes/access-requests.ts` - access request handling

2. **Update existing routes:**
   - `auth.ts` - add pre-authentication checks
   - `profiles.ts` - add invite tracking

3. **Add API endpoints:**
   ```typescript
   // Invite management (parents only)
   POST /api/invites/generate - generate new invite code
   GET /api/invites/my-invites - get parent's invite codes
   GET /api/invites/:code - validate invite code
   DELETE /api/invites/:id - deactivate invite code

   // Access requests
   POST /api/access-requests - submit access request
   POST /api/access-requests/send-email - send email notification

   // Admin endpoints
   GET /api/admin/access-requests - list pending requests
   POST /api/admin/access-requests/:id/approve - approve request
   POST /api/admin/access-requests/:id/reject - reject request
   GET /api/admin/invite-analytics - invite usage analytics
   POST /api/admin/whitelist - add email to whitelist
   DELETE /api/admin/whitelist/:id - remove from whitelist
   POST /api/admin/ban-email - ban email address
   DELETE /api/admin/ban-email/:id - unban email
   DELETE /api/admin/users/:id - remove user
   ```

### Phase 4: Parent Dashboard Enhancements
**Files to modify:** `src/components/ParentDashboard.tsx`

1. **Add invite management section:**
   - Generate new invite links
   - View existing invite codes with usage stats
   - Copy invite links to clipboard
   - Deactivate invite codes

2. **Add invite analytics:**
   - Show who signed up using parent's invites
   - Display invite code usage statistics

### Phase 5: Admin Screen Enhancements  
**Files to modify:** `src/components/AdminScreen.tsx`

1. **Add new admin tabs:**
   - "Access Requests" - review pending requests
   - "Invite Analytics" - system-wide invite tracking
   - "User Management" - remove users, manage bans

2. **Add management features:**
   - Email whitelist management
   - Banned email management
   - User removal functionality
   - Invite code analytics and monitoring

### Phase 6: Email Integration
**Files to create:** `server/src/lib/email.ts`, `server/src/config/resend.ts`

1. **Set up Resend integration:**
   - Configure Resend API client
   - Create email templates for access requests
   - Add email sending functionality

2. **Email templates:**
   - Access request notification to admin
   - Access request confirmation to user
   - Approval/rejection notifications

### Phase 7: Frontend UX Improvements
**Files to modify:** Various component files

1. **Update navigation and messaging:**
   - Show appropriate messages for different user states
   - Handle loading states during authentication checks
   - Add proper error handling and user feedback

2. **Create new screens:**
   - Access request submitted confirmation
   - Invite validation screens
   - Admin access request management interface

### Phase 8: Security and Validation
**Files to modify:** All backend route files

1. **Add validation middleware:**
   - Validate invite codes
   - Check email whitelist/banlist
   - Rate limiting for access requests

2. **Security enhancements:**
   - Prevent abuse of invite generation
   - Validate all user inputs
   - Add proper error handling

## Implementation Tasks Breakdown

### Database Tasks
- [ ] Create migration for invite_codes table
- [ ] Create migration for invite_registrations table  
- [ ] Create migration for access_requests table
- [ ] Create migration for email_whitelist table
- [ ] Create migration for banned_emails table
- [ ] Add RLS policies for all new tables
- [ ] Add indexes for performance

### Backend API Tasks
- [ ] Create invite code generation logic
- [ ] Create invite validation logic
- [ ] Set up access request handling
- [ ] Integrate Resend email service
- [ ] Add authentication pre-checks
- [ ] Create admin management endpoints
- [ ] Add user removal functionality
- [ ] Add email ban functionality

### Frontend Tasks
- [ ] Update AuthScreen with eligibility checks
- [ ] Create AccessRequestForm component
- [ ] Create InviteValidation component
- [ ] Update ParentDashboard with invite management
- [ ] Update AdminScreen with new management tabs
- [ ] Add proper loading and error states
- [ ] Handle invite code URL parameters
- [ ] Add clipboard functionality for invite links

### Integration Tasks
- [ ] Connect frontend to new backend endpoints
- [ ] Test invite code generation and usage
- [ ] Test access request workflow
- [ ] Test email notifications
- [ ] Test admin approval/rejection flow
- [ ] Add comprehensive error handling
- [ ] Add proper user feedback messages

## Testing Strategy

1. **Unit Tests:**
   - Test invite code generation and validation
   - Test access request submission
   - Test email whitelist/banlist functionality

2. **Integration Tests:**
   - Test complete invite workflow
   - Test access request to approval workflow
   - Test admin user management features

3. **User Acceptance Tests:**
   - Parent can generate and share invite links
   - Users can successfully sign up via invite
   - Admin can manage access requests
   - Email notifications work correctly

## Security Considerations

1. **Invite Code Security:**
   - Use cryptographically secure random codes
   - Implement expiration and usage limits
   - Rate limit invite generation

2. **Access Control:**
   - Only parents can generate invites
   - Only admin can approve access requests
   - Proper authorization checks on all endpoints

3. **Email Security:**
   - Validate email formats
   - Prevent email enumeration attacks
   - Rate limit access requests by email

## Deployment Considerations

1. **Migration Strategy:**
   - Run database migrations
   - Update environment variables for Resend
   - Deploy backend changes first
   - Deploy frontend changes after backend is stable

2. **Rollback Plan:**
   - Keep old authentication flow available
   - Feature flags for new invite system
   - Database migration rollback scripts

## Success Metrics

1. **Functionality:**
   - Parents can successfully generate invite codes
   - Users can sign up via invite links
   - Access requests are processed correctly
   - Admin can manage users and bans effectively

2. **Security:**
   - No unauthorized users can create accounts
   - All access is properly tracked and auditable
   - Email notifications work reliably

3. **User Experience:**
   - Smooth onboarding for invited users
   - Clear feedback for access request users
   - Intuitive admin interface for management

This plan provides a comprehensive roadmap for implementing the invite-only system while maintaining security and user experience standards.