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
- **Community Scorer** (Default Role):
  - Can add new games to the community.
  - Can score games assigned to them or created by them.
- **Community Viewer**:
  - Read-only access to community data (teams, rosters, game history).

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
  - Configure Game Rules:
    - Period Length (e.g., 10, 12 mins).
    - Number of Periods (e.g., 4 quarters).
    - Overtime rules.
    - Foul limits (personal and team).
    - Timeouts per game/half.
- **Roster Management**:
  - **Auto-population**: When selecting a Saved Team during game creation, the app must automatically pull all team members into the specific Game Roster.
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

#### Mode A: Simple Scorer
Designed for casual games where tracking your own team's players is desired, but the opponent is just a score.
- **Home Team Scoring**:
  - Tapping +2/+3 prompts "Who?" (Quick select from active roster).
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
  - **Single-Tap Mode**: Tap 'Sub' -> Tap player on court (out) -> Tap player on bench (in).
  - **Drag-and-Drop Mode**: Drag bench player onto court player to swap instantly.
  - **Mass Subs**: "Clear Bench" or preset lineups for quick swaps.
- **Detailed Stats (Box Score)**:
  - Assists, Rebounds (Off/Def), Steals, Blocks, Turnovers.
- **Shot Charting**: 
  - Tap on court image to record shot location + result (Made/Missed).
- **Violations**:
  - Traveling, Double Dribble, etc. (categorized as Turnovers).

#### Common Scorer Features
- **Possession Arrow**: Toggle.
- **Game Log**:
  - Scrollable play-by-play.
  - **Editable Actions**: Recent actions must be expandable.
  - **Modification**: Ability to change the player, the points value, or delete an action entirely.
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
  - **Quick Entry**: "Name, Number" pairs.
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

## 4A. Implementation Plan: Player Profiles & Team History

### Phase 1: Database Schema Updates
1. **athletes table** (existing):
   - Add `email` (optional, for player lookup)
   - Add `birthDate` (optional, for age verification)
   - Add `status` enum (active, inactive, transferred)

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
     action TEXT NOT NULL, -- 'added', 'removed', 'number_changed', 'transferred'
     previousValue TEXT, -- previous jersey number
     newValue TEXT, -- new jersey number
     performedBy UUID, -- user who made change
     notes TEXT,
     createdAt TIMESTAMP DEFAULT NOW()
   );
   ```

### Phase 2: API Endpoints

#### Players API (`/api/players`)
- `GET /api/players` - Search players (by name, partial match)
- `GET /api/players/[id]` - Get player profile with membership history
- `POST /api/players` - Create new player profile
- `PATCH /api/players/[id]` - Update player details

#### Team Memberships API (`/api/teams/[id]/memberships`)
- `GET /api/teams/[id]/memberships` - Get active memberships (existing)
- `POST /api/teams/[id]/memberships` - Add player to team (enhance: search/create players)
- `PATCH /api/teams/[id]/memberships/[membershipId]` - Update jersey number
- `DELETE /api/teams/[id]/memberships/[membershipId]` - Soft remove (set endDate, log history)

#### Team Community Assignment (`/api/teams/[id]`)
- `PATCH` - Add/remove community assignment

### Phase 3: Frontend Updates

#### Team Edit Page (`/teams/[id]`)
1. **Team Details Section**:
   - Edit team name, short code, color
   - **Community Assignment dropdown**:
     - Show user's communities
     - "No Community" option
     - Only if user is admin of community

2. **Roster Management**:
   - **Add Player Section**:
     - Search existing players input
     - "Create New Player" button with modal
     - Quick add: Name + Jersey Number
   - **Player List**:
     - Show: Jersey #, Name, Status badge
     - Edit button (pencil icon) → opens player quick-edit modal
     - Remove button → soft delete with confirmation

3. **Player Quick-Edit Modal**:
   - Edit jersey number
   - View player history link
   - Remove from team button

#### Player Profile Page (New: `/players/[id]`)
1. **Player Details**:
   - Name (editable)
   - Birth date
   - Email (if available)

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
- `TEAM_COMMUNITY_ASSIGNED` - Team assigned to community
- `TEAM_COMMUNITY_UNASSIGNED` - Team removed from community

### Implementation Order
1. Database migration for new columns + player_history table
2. API endpoints for players CRUD + membership history
3. Update team membership POST to support player search
4. Update team edit page UI for community assignment
5. Add player history endpoint + frontend display
6. Add player quick-edit modal on team page
7. Update activity logging
8. Tests for new endpoints
9. Documentation updates

### Database Migration Commands
```sql
-- Add columns to athletes
ALTER TABLE athletes ADD COLUMN email TEXT;
ALTER TABLE athletes ADD COLUMN birthDate DATE;

-- Add columns to teamMemberships
ALTER TABLE teamMemberships ADD COLUMN communityId UUID REFERENCES communities(id);
ALTER TABLE teamMemberships ADD COLUMN createdBy TEXT;
ALTER TABLE teamMemberships ADD COLUMN notes TEXT;

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
