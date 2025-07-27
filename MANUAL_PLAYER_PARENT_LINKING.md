# Manual Player to Parent Linking Feature

## Overview

This feature allows admins to link manual players (players who haven't registered yet) to parent accounts, enabling parents to view their children's game statistics even before the children register for the application.

## Database Changes

### Schema Updates

Added new fields to the `manual_players` table:
- `parent_id`: VARCHAR(255) - Links to the parent user's ID
- `parent_linked_by`: VARCHAR(255) - ID of the admin who created the link
- `parent_linked_at`: TIMESTAMP - When the link was created

### Migration File

Created `server/src/db/migrations/20250109000001_add_manual_player_parent_link.sql`:
```sql
-- Add parent linking fields to manual_players table
ALTER TABLE manual_players 
ADD COLUMN parent_id VARCHAR(255),
ADD COLUMN parent_linked_by VARCHAR(255),
ADD COLUMN parent_linked_at TIMESTAMP;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_manual_players_parent_id ON manual_players(parent_id);
CREATE INDEX IF NOT EXISTS idx_manual_players_parent_linked_by ON manual_players(parent_linked_by);
```

## Backend Changes

### API Endpoints

#### New Endpoints in `server/src/routes/games.ts`:

1. **Link Manual Player to Parent**
   - `PATCH /games/admin/manual-players/:manualPlayerId/link-parent`
   - Admin only
   - Links a manual player to a parent user

2. **Unlink Manual Player from Parent**
   - `PATCH /games/admin/manual-players/:manualPlayerId/unlink-parent`
   - Admin only
   - Removes the link between manual player and parent

#### New Endpoint in `server/src/routes/profiles.ts`:

3. **Get Parent's Manual Players**
   - `GET /profiles/my-manual-players`
   - Returns all manual players linked to the authenticated parent

### Games Filtering Updates

Updated the games filtering logic in `server/src/routes/games.ts` to include games where:
- Parent's registered children participated (existing functionality)
- Parent's linked manual players participated (new functionality)

This ensures parents see all games involving any of their linked players, whether registered or not.

### Manual Players Endpoint Updates

Enhanced the existing manual players endpoint to include parent information:
- Added `parentId`, `parentLinkedBy`, and `parentLinkedAt` fields to the response

## Frontend Changes

### API Client Updates (`src/lib/api.ts`)

Added new methods:
- `linkManualPlayerToParent(manualPlayerId, parentId)`
- `unlinkManualPlayerFromParent(manualPlayerId)`
- `getMyManualPlayers()`

### Admin Interface Updates (`src/components/AdminScreen.tsx`)

#### New UI Components:
1. **Link to Parent Button**: Added alongside the existing "Link to User" button
2. **Parent Linking Form**: Similar to user linking form but for selecting parents
3. **Parent Information Display**: Shows which parent each manual player is linked to
4. **Parent Link/Unlink Buttons**: Individual buttons for each manual player

#### Enhanced Manual Player List:
- Shows both user and parent linking status
- Displays parent information when linked
- Separate buttons for linking/unlinking users vs parents
- Color-coded indicators (blue for parent links, green for user links)

### Parent Dashboard Updates (`src/components/ParentDashboard.tsx`)

#### Enhanced Child Selection:
- Combined dropdown showing both registered children and manual players
- Organized with optgroups: "Registered Children" and "Manual Players"
- Clear labeling to distinguish between registered and manual players

#### Stats Display Updates:
- Shows appropriate stats for both registered children and manual players
- Manual players show "N/A" for features they don't have (like total points from workouts)
- Games stats work for both types

#### Conditional Feature Display:
- Workouts section only shows for registered children
- Games section works for both types
- Profile information adapts to show manual player details (name, jersey number)

## User Experience

### For Admins:
1. Navigate to Admin → Manual Players
2. Use "Link to Parent" button to open parent linking form
3. Select manual player and parent from dropdowns
4. Link/unlink as needed
5. View status of all links in the manual players list

### For Parents:
1. Login and navigate to Parent Dashboard
2. See both registered children and manual players in the dropdown
3. Select any child/player to view their game statistics
4. Manual players are clearly labeled as "Not Registered"
5. Can view game performance even for unregistered children

## Key Benefits

1. **Early Engagement**: Parents can track their children's performance before registration
2. **Seamless Transition**: When children register, their manual player data can be linked to their account
3. **Complete Visibility**: Parents see all games their children participated in
4. **Admin Control**: Full administrative control over player-parent relationships
5. **Data Integrity**: Separate tracking prevents data conflicts during registration

## Implementation Status

✅ **Completed:**
- Database schema updates
- Backend API endpoints
- Frontend admin interface
- Parent dashboard enhancements  
- Games filtering logic
- API client methods

⏳ **Pending:**
- Database migration execution (requires live database connection)

## Migration Instructions

To deploy this feature:

1. Run the database migration:
   ```bash
   cd server
   node run-migrations.js
   ```

2. Restart the application to pick up the new endpoints

3. The feature will be immediately available in the admin interface

## Future Enhancements

Potential improvements for future iterations:
- Bulk linking operations for multiple manual players
- Email notifications to parents when their children are linked
- Automatic linking suggestions based on name matching
- Statistics comparison between manual and registered player periods
- Export functionality for manual player statistics