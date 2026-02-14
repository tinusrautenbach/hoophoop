# Basketball Scoring App - Functional Specification

## 1. Introduction
This document outlines the functional requirements for a web-based basketball scoring application. The primary goal is to provide a digital scoring interface for game officials (Scorers) and a real-time display for spectators.

## 2. User Roles

### 2.1 Scorer (Admin)
- **Authentication**:
  - Must log in via **Google** (Social Login) to create or manage games.
  - "Guest Scorer" mode (optional for MVP, restricts data persistence).
- Responsible for accurate tracking of the game state.
- Has full control over the game clock, score, fouls, timeouts, and game flow.
- **Mobile-First Design**: The scorer interface must be fully functional and optimized for mobile devices (large touch targets, no hover states).
- **Multiple Simultaneous Scorers**:
  - Multiple authorized users can score the same game simultaneously.
  - All scorers see the same game state in real-time.
  - Changes made by one scorer are immediately visible to all other scorers and spectators.
  - Conflict resolution: Last-write-wins for most fields; atomic operations for scoring events.

### 2.2 Spectator
- View-only access to the game state.
- Needs real-time updates without manual refresh.
- Interface optimized for readability on various devices (mobile, tablet, desktop).
- **Mobile Experience**: Responsive design ensures the scoreboard is legible even on small phone screens.

### 2.3 Community Roles (New)
- **Community Admin**:
  - Can manage all aspects of a community (teams, players, games).
  - Can invite/remove members and assign roles.
  - Can revoke default scoring rights.
  - **Merge Player Profiles**: Ability to merge duplicate player profiles into a single canonical profile. When merging:
    - Select a "primary" profile and one or more "duplicate" profiles.
    - All team memberships, game roster entries, and stats from duplicates are reassigned to the primary profile.
    - Duplicate profiles are soft-deleted (archived) with a reference to the merged-into profile.
    - Activity log records the merge action for audit purposes.
- **Community Scorer** (Default Role):
  - Can add new games to the community.
  - Can score games assigned to them or created by them.
- **Community Viewer**:
  - Read-only access to community data (teams, rosters, game history).

### 2.4 World Admin (Super Admin)
- **God Mode**: Full unrestricted access to all communities, games, teams, players, and system data.
- **Cross-Community Access**: Can view and manage any community as if they were a Community Admin, without needing an invitation or membership.
- **Global Player Management**:
  - Can mark any player as **"World Available"** (visible to all communities in player search).
  - Can unmark "World Available" status.
  - Can merge player profiles across communities.
- **System Oversight**:
  - Can view all system-wide activity logs and metrics.
  - Can view all public and private games.
  - Can disable/enable user accounts.
  - Can promote/demote users to/from World Admin role.
- **Data Integrity**:
  - Can force-end stuck games.
  - Can correct game scores and stats retroactively.
  - Can delete communities (with soft-delete and archive).
- **Implementation**:
  - World Admin is stored as a flag on the `users` table (`isWorldAdmin: boolean`).
  - All permission checks must first check `isWorldAdmin` — if true, bypass all community/ownership checks.
  - World Admin actions are logged with a special `WORLD_ADMIN` prefix in the activity log.

## 3. Core Features

### 3.0 Multi-Scorer Architecture
#### Centralized Game State Management
To support multiple simultaneous scorers, the game state must be managed centrally:

**Centralized Timer (Recommended)**
- The game clock runs on the server, not on any individual client.
- When a scorer starts/stops the timer, the command goes to the server.
- The server maintains the authoritative clock state (running/stopped, current time).
- All clients (scorers and spectators) receive clock updates from the server.
- **Advantages**:
  - Prevents clock drift between multiple scorers.
  - Ensures all viewers see the exact same time.
  - Survives client disconnections/reconnections.
  - Single source of truth for game timing.

**Alternative: Client-Authoritative with Sync**
- One scorer is designated as the "primary" timer controller.
- Other scorers can view but not control the timer.
- Simpler to implement but less flexible.

#### Real-Time Synchronization
- **Socket.IO rooms**: All scorers and spectators join a game-specific room.
- **Broadcast pattern**: State changes are broadcast to all room members.
- **Optimistic UI**: Local updates happen immediately, then sync with server.
- **Conflict resolution**: 
  - Scoring events are append-only (no conflicts).
  - Game state updates (score, fouls) use last-write-wins.
  - Timer state changes are atomic operations.

### 3.1 Game Setup (Pre-Game)
- **Create New Game**:
  - Input Team Names (Home vs. Guest).
  - **Public Visibility Toggle**:
    - **Private** (default): Game is only accessible via direct link or game code.
    - **Public - General (World)**: Game appears on the World Public Dashboard, visible to anyone.
    - **Public - Community Only**: Game appears only on the Community Portal dashboard, visible to community members and visitors to the community URL.
  - Configure Game Rules:
    - Period Length (e.g., 10, 12 mins).
    - Number of Periods (e.g., 4 quarters).
    - Overtime rules.
    - Foul limits (personal and team).
    - Timeouts per game/half.
- **Roster Management**:
  - **Auto-population**: When selecting a Saved Team during game creation, the app must automatically pull all team members into the specific Game Roster.
  - **Bench Selection (Pre-Game)**:
    - After roster auto-population, display a **bench selection screen** showing all players in the team.
    - **By default, ALL players are selected** (checked) as available for the game bench.
    - Scorer can **deselect** individual players who are absent/unavailable to exclude them from this game's bench.
    - Only selected players will appear in the substitution interface during the live game.
    - This step occurs before the game transitions to "Live" status.
  - **Force Roster**: A game cannot be started (transitioned to "Scheduled" or "Live") until both teams have at least 1 player in their roster (unless marked as 'adhoc').
  - Starters: Ability to mark active players from the roster.

### 3.2 Scorer's Interface (Live Game)
The control center handling high-frequency inputs. **Must work on Mobile.**

#### Multi-Scorer Capabilities
- **Join Existing Game**: Scorers can join a game using a game code or link (if authorized).
- **Permission Levels**:
  - **Owner**: Full control, can authorize other scorers, end game.
  - **Co-Scorer**: Can score, start/stop timer, make substitutions (configurable).
  - **Viewer**: View-only access to scorer interface (for training/oversight).
- **Presence Indicators**: Show which scorers are currently active on the game.
- **Activity Feed**: Display which scorer performed each action (for accountability).
- **Conflict Notifications**: If two scorers try to perform conflicting actions (e.g., both calling timeout), notify both and allow resolution.

#### Scoring Player Selection (6-Player Layout)
When a point value (+1, +2, +3) is tapped, the "Who scored?" selection screen must follow these strict rules:
- **Exactly 6 options** are displayed:
  - **5 players**: The currently active on-court players from the scoring team (showing jersey number and name).
  - **1 "Opponent" button**: Represents the opposing team as a single entity (for when the other team scores, e.g., free throws awarded).
- **Responsive Layout**: All 6 options must be **fully visible on the first screen** without any scrolling required, on all device sizes (mobile portrait, mobile landscape, tablet).
  - Recommended layout: 2 rows x 3 columns of large touch-friendly buttons, or 3 rows x 2 columns on narrow screens.
  - Minimum touch target: 48x48px per button.
- **No additional navigation**: The player selection must open as an overlay/modal that shows all 6 options immediately — no tabs, no pagination, no scroll.

#### Mode A: Simple Scorer
Designed for casual games where tracking your own team's players is desired, but the opponent is just a score.
- **Home Team Scoring**:
  - Tapping +2/+3 opens the 6-player selection overlay (5 own players + 1 opponent).
  - Tracks individual points and fouls for Home players.
- **Guest Team Scoring**:
  - Simple +1, +2, +3 buttons (no player assignment).
  - Team Fouls tracking only.
- **Team Positioning**:
  - **Our Team on Left**: The logged-in user's team (owner's team) should always be positioned on the left side (Home) of the interface for consistency.
- **Game Clock**: Standard Start/Stop/Edit.
- **Undo**: Global undo button.

#### Mode B: Advanced Scorer
Designed for official games, requiring detailed stat tracking.
- **Everything in Simple Mode, plus:**
- **Quick Subs Interface**:
  - **On-Court Players in Top Row**: When the subs interface opens, players currently **on the court** must be displayed in the **top row/section**, clearly separated from bench players. This ensures the scorer can immediately see who is playing.
  - **Bench Players Below**: Players on the bench are shown in a separate section below the on-court players.
  - **Single-Tap Mode**: Tap 'Sub' -> Tap player on court (out) -> Tap player on bench (in).
  - **Drag-and-Drop Mode**: Drag bench player onto court player to swap instantly.
  - **Mass Subs**: "Clear Bench" or preset lineups for quick swaps.
  - **In-Game Roster Amendment**:
    - An **"Amend Roster"** button is accessible directly from the subs interface.
    - This allows the scorer to:
      - **Change a player's jersey number** mid-game (updates the game roster snapshot).
      - **Add a new player** to the game roster (e.g., late arrival).
      - **Remove a player** from the game roster.
    - Changes to jersey numbers update the display immediately across all views (scoreboard, game log, box score).
    - Jersey number changes during a game are logged in the activity history.
- **Detailed Stats (Box Score)**:
  - Assists, Rebounds (Off/Def), Steals, Blocks, Turnovers.
- **Shot Charting**: 
  - Tap on court image to record shot location + result (Made/Missed).
- **Violations**:
  - Traveling, Double Dribble, etc. (categorized as Turnovers).

#### Common Scorer Features
- **Possession Arrow**: Toggle.
- **Game Log**:
  - Scrollable play-by-play (showing last 10 entries on main view).
  - **Editable Actions**: Recent actions must be expandable.
  - **Modification**: Ability to change the player, the points value, or delete an action entirely.
  - **Score Recalculation on Deletion**: When a scoring event is deleted from the game log, the **total score for both teams must be automatically recalculated** by re-reducing all remaining game events. The updated score must be:
    - Reflected immediately in the scorer's UI.
    - Broadcast to all spectators and co-scorers in real-time.
    - Persisted to the database.
  - **History**: Full track record of changes to ensure data integrity.

#### Share & Connect
- **Game Link Sharing**:
  - **QR Code Display**: A prominent button "Share Game" opens a modal with a large QR code pointing to `https://basket.ls.co.za/game/[id]`.
  - **Copy Link**: Button to copy the spectator URL to clipboard.
  - **WhatsApp/Native Share**: Use `navigator.share` if available for native mobile sharing.

### 3.3 Spectator Interface
A clean, high-visibility display of the current game state, optimized for mobile fans.

#### Essentials (Always Visible / Top Fold)
- **Scoreboard**:
  - Huge Clock & Period Indicator.
  - Team Names & Scores.
  - **Foul Count**: Clear indicator of Team Fouls for current quarter (Bonus/Double Bonus status).
- **Possession Arrow**.

#### Tabs / Lower Section
- **Play-by-Play (Game Log)**: 
  - Real-time scrolling feed of events (e.g., "10:02 - #23 Smith (Home) made 2pt jump shot").
- **Box Score**:
  - **Home Team**: Table showing Points, Fouls, (and Rebounds/Assists/etc if Advanced Mode).
  - **Guest Team**: Total score (and players if tracked).
  - Ability to toggle between active players and full roster.

### 3.4 Team & Roster Management
- **Add Team**:
  - Simple form: Team Name, Short Code (3 letters), Color.
  - Ability to save teams for future games (if logged in).
  - **Community Assignment**: Teams can be assigned to a Community for centralized management.
- **Add Players**:
  - **Search for Existing Players**:
    - A clearly labeled **"Search Existing Players"** input field at the top of the add-player section.
    - Search matches on **first name AND/OR surname** (partial match supported).
    - **Search Scope**:
      - By default, search returns only players **within the user's community**.
      - Players marked as **"World Available"** by a World Admin also appear in search results regardless of community.
      - Search results display: Name, DOB (for disambiguation), current team(s), community.
    - Selecting a search result adds the existing player profile to the team (with jersey number prompt).
  - **Create New Player**:
    - A clearly labeled **"Add New Player"** button/section, visually distinct from search.
    - Required fields: **First Name**, **Surname**, **Date of Birth (DOB)**, Jersey Number.
    - DOB is stored on the player profile and used for:
      - Disambiguation in search results (common names).
      - Age verification for divisions/leagues (future).
    - Optional fields: Email.
  - **Quick Entry**: "Name, Number" pairs for rapid roster building.
  - **Bulk Paste**: Paste a list like "23 Jordan, 33 Pippen" to auto-parse.
  - **Edit/Delete**: Long press or click edit to modify player details or remove from roster.
- **On-Court Management**:
  - **Visual Court**: Drag players from "Bench" list to "Court" list.
  - **Time Tracking**: 
    - App automatically calculates "Minutes Played" based on substitution events and game clock running time.
    - Scorer can see current time-on-court for active players.

### 3.4.1 Player Profiles & History (New)
Players are global entities that can belong to multiple teams over time, with full history tracking.

#### Player Profile
- **Global Player Identity**: Each player has a unique profile stored once.
- **Player Fields**:
  - First Name (required)
  - Surname (required)
  - Date of Birth (required)
  - Email (optional)
  - **World Available** flag (boolean, default false — only World Admins can set this)
- **Team Membership History**: Track all teams a player has been associated with.
  - For each membership, store:
    - Team name
    - Jersey number(s) used with that team
    - Start date
    - End date (NULL for current membership)
    - Status (Active/Inactive)
- **Player Edit Screen**:
  - View/edit player name and basic details.
  - **Team History Section**: Display all team memberships chronologically.
    - Show team name, jersey number, date range.
    - Indicate currently active memberships.
  - Ability to edit historical jersey numbers (corrections).
  - Ability to end a membership (set end date to today).

#### Team Roster Management (Enhanced)
- **Add Players to Team**:
  - Search existing players OR create new player profiles.
  - Assign jersey number for this specific team.
  - Membership is effective immediately.
- **Edit Player on Team**:
  - Update jersey number for current membership.
  - View player profile directly from team roster.
- **Remove Player from Team**:
  - Soft-delete: Set end date instead of deleting record.
  - Preserve historical data for reports/records.
  - Log action in activity history.

#### Player Profile Merging (Community Admin)
- **Purpose**: Clean up duplicate player entries that inevitably occur.
- **Access**: Community Admins can merge players within their community. World Admins can merge across communities.
- **Merge Flow**:
  1. Admin searches for and selects two (or more) player profiles to merge.
  2. Admin selects the **primary profile** (the one to keep).
  3. System displays a preview of what will be merged (memberships, game appearances, stats).
  4. On confirmation:
     - All `teamMemberships` from duplicate profiles are reassigned to the primary profile.
     - All `gameRosters` entries referencing duplicate athlete IDs are updated to the primary ID.
     - All `game_events` referencing duplicate roster entries are preserved (data integrity).
     - Duplicate profiles are marked as `status: 'merged'` with a `mergedIntoId` reference.
     - Activity log records: who merged, which profiles, when.
  5. Merged profiles are hidden from search but retained in database for audit.

#### Community Team Management (New)
- **Assign Team to Community**:
  - Community Admins can create teams directly within a community.
  - Existing personal teams can be transferred to a community.
  - Teams can only belong to one community at a time.
- **Shared Player Pool** (Future):
  - Community admins can manage players that are shared across multiple community teams.
  - Track player eligibility for different divisions/ages.

### 3.5 Post-Game & Export
- **End Game Action**: Confirms final score and changes status to 'Final'.
- **Share Report**:
  - **Export as HTML**: Button to generate a standalone `.html` file (containing Box Score + Play-by-Play).
  - **Native Share**: Triggers mobile share sheet to send this file via WhatsApp, Email, etc.

### 3.6 Community Management (New)
- **Registration & Onboarding**:
  - Users sign up via Social Login (Google/Clerk).
  - Post-signup, users can create a new Community (e.g., "St. Mary's High School") or join an existing one via invite.
- **Member Management**:
  - **Invite Flow**: Admins can invite users via email from their profile/community page.
  - **Role Assignment**: Admins assign roles (Admin, Scorer, Viewer) upon invitation or later.
  - **Permissions**:
    - Default: New members get "Scorer" rights (can add/score games).
    - Configurable: Admins can restrict specific users to "Viewer" only.
- **Activity Logging**:
  - System tracks all significant user actions (Game Created, Score Added, Member Invited, Roster Changed).
  - Logs are viewable by Community Admins for audit purposes.

### 3.7 Profile Page
- **Personal Info**: Display name, email (from auth provider).
- **My Communities**: List of communities the user belongs to.
- **Pending Invites**: Ability to accept/decline community invitations.
- **Activity History**: Personal log of recent actions.
- **Logout**: Ability to securely sign out of the application.

### 3.8 Public Game Portals (New)

#### 3.8.1 World Public Dashboard
- **URL**: `https://basket.ls.co.za/live` (or `/public`)
- **Purpose**: A public-facing page (no login required) that shows all games marked as "Public - General".
- **Live Games Tab** (default):
  - Displays all currently live public games in real-time.
  - Games are **grouped by community** (community name as section header).
  - Each game card shows: Team names, current score, period/clock, community name.
  - Tapping a game card navigates to the spectator view (`/game/[id]`).
  - Games with no community are grouped under "Independent Games".
- **Historical Tab**:
  - Displays completed (status: 'Final') public games.
  - Grouped by community.
  - Sortable by date (most recent first).
  - Search/filter by team name, community name, or date range.
  - Tapping a completed game shows the final box score and play-by-play.
- **Auto-Refresh**: Live games update scores in real-time via Socket.io (the dashboard joins a special "public-games" room).

#### 3.8.2 Community Portal
- **URL**: `https://basket.ls.co.za/community/[slug]` (each community gets a unique URL slug).
- **Purpose**: A community-specific public page showing games for that community only.
- **Distinct from World Dashboard**: This URL is separate and shows only content relevant to the specific community.
- **Content**:
  - **Community Header**: Community name, logo (future), description.
  - **Live Games Tab**: All currently live games belonging to this community (both "Public - General" and "Public - Community Only" games).
  - **Historical Tab**: All completed games for this community, with search/filter.
  - **Teams Tab** (optional): List of teams in the community with rosters.
- **Access Control**:
  - Games marked "Public - Community Only" appear **only** on this community portal, NOT on the World Dashboard.
  - Games marked "Public - General" appear on BOTH the community portal AND the World Dashboard.
  - Private games do not appear on any portal.
- **No Login Required**: The community portal is publicly accessible for viewing.

### 3.9 Mobile Application (React Native) (New)

#### 3.9.1 Overview
A native mobile application for **Android** and **iOS** built with **React Native** (Expo managed workflow) that provides a subset of the web application's functionality, focused on game creation and scoring.

#### 3.9.2 Initial Scope (Reduced)
The mobile app MVP is limited to:
- **Authentication**: Login via Google (same Clerk auth as web).
- **Game Creation**: Create new games with team selection and basic configuration.
- **Live Scoring**: Full scoring interface (Simple Mode) with:
  - 6-player scoring layout (same as web).
  - Game clock control (start/stop/edit).
  - Foul tracking.
  - Game log view.
  - Score recalculation on event deletion.
- **Game List**: View user's games (active and completed).

#### 3.9.3 Features NOT in Mobile MVP
The following remain web-only for the initial release:
- Advanced Scorer mode (shot charting, detailed stats).
- Team & roster management (create/edit teams, manage players).
- Community management (create/manage communities, invitations).
- Public dashboards and community portals.
- Game export/sharing (HTML reports).
- Player profile management.
- World Admin functionality.

#### 3.9.4 Architecture & Shared Code
- **Framework**: React Native with Expo (managed workflow for easier app store deployment).
- **State Management**: Zustand (same as web — store logic can be shared).
- **Real-Time**: Socket.io-client (same event protocol as web).
- **Auth**: `@clerk/clerk-expo` for native authentication.
- **Shared Types**: TypeScript types/interfaces from the web app are extracted into a shared `packages/types` directory used by both web and mobile.
- **API Communication**: Mobile app calls the same REST API and Socket.io server as the web app.

#### 3.9.5 App Store Deployment Scaffolding
- **Expo Application Services (EAS)**: Configure EAS Build and EAS Submit for automated builds and store submissions.
- **Android**: Generate signing keys, configure `app.json` for Google Play Store metadata.
- **iOS**: Configure provisioning profiles, App Store Connect metadata, and TestFlight for beta testing.
- **CI/CD**: GitHub Actions workflow for:
  - Running tests on PR.
  - Building preview APK/IPA on merge to develop.
  - Building production release on merge to main.
  - Submitting to app stores on release tag.

## 4A. Implementation Plan: Player Profiles & Team History

### Phase 1: Database Schema Updates
1. **athletes table** (existing):
   - Add `firstName` (required, split from current `name`)
   - Add `surname` (required, split from current `name`)
   - Add `email` (optional, for player lookup)
   - Add `birthDate` (required for new players, for age verification and search disambiguation)
   - Add `status` enum (active, inactive, transferred, merged)
   - Add `isWorldAvailable` boolean (default false — only World Admins can set)
   - Add `mergedIntoId` UUID (nullable, references athletes.id — set when profile is merged)
   - Add `communityId` UUID (nullable, references communities.id — the community the player belongs to)

2. **teamMemberships table** (enhance):
   - Add `communityId` (track which community context membership was created)
   - Add `createdBy` (user who added player to team)
   - Add `notes` (optional, for roster notes)
   - Change `endDate` behavior: Default NULL = current, set to date when removed

3. **New table: playerHistory**:
   ```sql
   CREATE TABLE player_history (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     athleteId UUID REFERENCES athletes(id) ON DELETE CASCADE,
     teamId UUID REFERENCES teams(id) ON DELETE CASCADE,
     action TEXT NOT NULL, -- 'added', 'removed', 'number_changed', 'transferred', 'merged'
     previousValue TEXT, -- previous jersey number or merged-from profile ID
     newValue TEXT, -- new jersey number or merged-into profile ID
     performedBy UUID, -- user who made change
     notes TEXT,
     createdAt TIMESTAMP DEFAULT NOW()
   );
   ```

### Phase 2: API Endpoints

#### Players API (`/api/players`)
- `GET /api/players` - Search players (by firstName and/or surname, partial match)
  - Query params: `q` (search term), `communityId` (scope to community), `includeWorldAvailable` (boolean)
  - Default behavior: returns community-scoped players + world-available players
- `GET /api/players/[id]` - Get player profile with membership history
- `POST /api/players` - Create new player profile (requires firstName, surname, birthDate)
- `PATCH /api/players/[id]` - Update player details
- `POST /api/players/merge` - Merge player profiles (Community Admin or World Admin only)

#### Team Memberships API (`/api/teams/[id]/memberships`)
- `GET /api/teams/[id]/memberships` - Get active memberships (existing)
- `POST /api/teams/[id]/memberships` - Add player to team (enhance: search/create players)
- `PATCH /api/teams/[id]/memberships/[membershipId]` - Update jersey number
- `DELETE /api/teams/[id]/memberships/[membershipId]` - Soft remove (set endDate, log history)

#### Team Community Assignment (`/api/teams/[id]`)
- `PATCH` - Add/remove community assignment

#### World Admin API (`/api/admin`)
- `GET /api/admin/users` - List all users (World Admin only)
- `PATCH /api/admin/users/[id]` - Update user flags (isWorldAdmin, etc.)
- `PATCH /api/admin/players/[id]/world-available` - Toggle World Available flag on a player
- `GET /api/admin/activity-logs` - View all system activity logs
- `POST /api/admin/games/[id]/force-end` - Force-end a stuck game

### Phase 3: Frontend Updates

#### Team Edit Page (`/teams/[id]`)
1. **Team Details Section**:
   - Edit team name, short code, color
   - **Community Assignment dropdown**:
     - Show user's communities
     - "No Community" option
     - Only if user is admin of community

2. **Roster Management**:
   - **Search Existing Players Section** (clearly labeled):
     - Search input with placeholder "Search by first name or surname..."
     - Results scoped to community + world-available players
     - Results show: Name, DOB, current team(s)
     - Select result → prompt for jersey number → add to team
   - **Add New Player Section** (clearly labeled, visually distinct):
     - "Add New Player" button opens form/modal
     - Fields: First Name, Surname, Date of Birth, Jersey Number
     - Optional: Email
   - **Player List**:
     - Show: Jersey #, Name, DOB, Status badge
     - Edit button (pencil icon) → opens player quick-edit modal
     - Remove button → soft delete with confirmation

3. **Player Quick-Edit Modal**:
   - Edit jersey number
   - View player history link
   - Remove from team button

#### Player Profile Page (New: `/players/[id]`)
1. **Player Details**:
   - First Name, Surname (editable)
   - Birth date
   - Email (if available)
   - World Available badge (if set)

2. **Team History Section**:
   - Timeline view of all team memberships
   - Columns: Team, Jersey #, Period, Status
   - Filter by: All / Active / Historical
   - Export history option

3. **Activity Log**:
   - Show who added/removed the player from each team
   - Timestamps for each action

### Phase 4: Activity Logging Integration
Update `logActivity` to include:
- `PLAYER_CREATED` - New player profile added
- `PLAYER_ADDED_TO_TEAM` - Player joined team
- `PLAYER_REMOVED_FROM_TEAM` - Player left team
- `PLAYER_NUMBER_CHANGED` - Jersey update
- `PLAYER_MERGED` - Player profiles merged (records source and target)
- `PLAYER_WORLD_AVAILABLE_SET` - World Admin marked player as world available
- `TEAM_COMMUNITY_ASSIGNED` - Team assigned to community
- `TEAM_COMMUNITY_UNASSIGNED` - Team removed from community
- `WORLD_ADMIN_ACTION` - Any action performed by a World Admin on resources they don't own

### Implementation Order
1. Database migration for new columns + player_history table
2. API endpoints for players CRUD + membership history
3. Update team membership POST to support player search
4. Update team edit page UI for community assignment
5. Add player history endpoint + frontend display
6. Add player quick-edit modal on team page
7. Implement player merge API and UI
8. Update activity logging
9. Tests for new endpoints
10. Documentation updates

### Database Migration Commands
```sql
-- Add columns to athletes
ALTER TABLE athletes ADD COLUMN firstName TEXT;
ALTER TABLE athletes ADD COLUMN surname TEXT;
ALTER TABLE athletes ADD COLUMN email TEXT;
ALTER TABLE athletes ADD COLUMN birthDate DATE;
ALTER TABLE athletes ADD COLUMN isWorldAvailable BOOLEAN DEFAULT FALSE;
ALTER TABLE athletes ADD COLUMN mergedIntoId UUID REFERENCES athletes(id);
ALTER TABLE athletes ADD COLUMN communityId UUID REFERENCES communities(id);

-- Migrate existing name data to firstName/surname
-- UPDATE athletes SET firstName = split_part(name, ' ', 1), surname = substring(name from position(' ' in name) + 1);

-- Add columns to teamMemberships
ALTER TABLE teamMemberships ADD COLUMN communityId UUID REFERENCES communities(id);
ALTER TABLE teamMemberships ADD COLUMN createdBy TEXT;
ALTER TABLE teamMemberships ADD COLUMN notes TEXT;

-- Add isWorldAdmin to users table
ALTER TABLE users ADD COLUMN isWorldAdmin BOOLEAN DEFAULT FALSE;

-- Create player_history table
CREATE TABLE player_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athleteId UUID REFERENCES athletes(id) ON DELETE CASCADE,
  teamId UUID REFERENCES teams(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  previousValue TEXT,
  newValue TEXT,
  performedBy TEXT,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT NOW()
);

-- Add public visibility to games
ALTER TABLE games ADD COLUMN visibility TEXT DEFAULT 'private'; -- 'private', 'public_general', 'public_community'

-- Add slug to communities for portal URLs
ALTER TABLE communities ADD COLUMN slug TEXT UNIQUE;
```

## 4. Non-Functional Requirements
- **Responsiveness**: Must work on typical laptop screens (scorers) and mobile phones (spectators).
- **Latency**: Updates from Scorer to Spectator should be near real-time (< 1 second).
- **Reliability**: Use local storage or similar to prevent data loss on browser refresh.
- **Connectivity**: Handle temporary disconnects gracefully (queue actions locally if possible, though MVP can assume stable connection).
- **Multi-Scorer Performance**:
  - Support at least 5 simultaneous scorers per game without performance degradation.
  - All scorers must see updates within 500ms of each other.
  - Timer sync accuracy: All clients should show the same clock time within 1 second.
- **Data Consistency**:
  - No lost scoring events even with concurrent updates.
  - Atomic operations for critical game state changes (end game, period transitions).
  - **Score recalculation**: Deleting a scoring event must atomically recalculate team totals.

## 5. Future Considerations (Post-MVP)
- Shot charts.
- Detailed box scores (rebounds, assists, steals).
- Season/League management.
- Import/Export game data.
- **Advanced Multi-Scorer Features**:
  - Role-based permissions (some scorers track only specific teams).
  - Scorer handoff protocol for shift changes.
  - Audit log of all scorer actions for dispute resolution.
  - Offline mode with conflict resolution when reconnecting.
- **Mobile App Expansion**:
  - Advanced Scorer mode on mobile.
  - Team & roster management on mobile.
  - Community management on mobile.
  - Offline scoring with sync on reconnect.
