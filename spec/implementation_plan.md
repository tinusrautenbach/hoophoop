# Basketball Scoring App - Implementation Plan

## Phase 1: Foundation & Data Layer (Done)
- [x] 1.1 Project Scaffolding
- [x] 1.2 Schema Design
- [x] 1.3 Database Setup
- [x] 1.4 API Core

## Phase 2: Game Setup & Real-time (Done)
- [x] 2.1 Game Creation UI
- [x] 2.2 Live Game Sync (Socket.io)
- [x] 2.5.1 New Tables (Migration)
- [x] 2.5.2 API - Team Management (CRUD verified)
- [x] 2.5.3 UI - Team Manager (Add/Remove members)
- [ ] 2.5.4 Advanced Team UI (Bulk Paste, Color Picker)

## Phase 3: Frontend Core (Scorer Views)
- [x] **3.1 Layout & Mobile Design**:
  - [x] Scorer Mode Selection (Simple vs Advanced) on Game Create.
- [x] **3.1.1 Mode A: Simple Scorer UI**:
  - [x] Integrated points-first scoring buttons.
  - [x] Fouls tracking per team with period-based resets.
- [x] **3.1.2 Mode B: Advanced Scorer**:
  - [x] Bench substitutions with DnD.
  - [x] Action palette + Quick Scoring buttons.
  - [x] Shot chart integration.
- [x] **3.2 Shared Component Polish**:
  - [x] **3.2.1 Game Clock**: Period & Clock management with local sync and server backup.
  - [ ] **3.2.2 Game Log**: 
    - [x] Vertical feed at bottom.
    - [ ] Expandable action items.
    - [ ] Edit/Delete modal for individual events.
  - [x] **3.2.3 Status Indicators**: Possession arrow, Foul Count alerts (Bonus indicators).
  - [x] **3.2.4 Points-First Flow**: Support for clicking points then selecting player/team.
- [ ] **3.3 Roster Enforcement & Positioning**:
  - [x] Auto-populate game roster from team ID on game creation (API).
  - [ ] Enforce roster requirement on game start button.
  - [ ] Logic to ensure owner's team is always Home (Left).

## Phase 4: Share & Public Views (Done)
- [x] 4.1 Live Scoreboard (Public)
- [x] 4.2 QR Code Sharing

## Phase 5: Multi-Scorer & Centralized Timer (NEW)
- [ ] **5.1 Centralized Timer Architecture**:
  - [ ] Create server-side timer service in Socket.io handler
  - [ ] Add `timerStartedAt` timestamp field to games table
  - [ ] Implement timer start/stop commands ('timer-control' socket events)
  - [ ] Server broadcasts clock updates every second to all room members
  - [ ] Persist timer state to database every 3-5 seconds
  - [ ] Remove client-side timer ticking (all timing comes from server)
  - [ ] Add server-side timer recovery on restart (load active games, resume timers)
  
- [ ] **5.2 Multi-Scorer Support**:
  - [ ] Create `game_scorers` table (gameId, userId, role, joinedAt)
  - [ ] Add "Invite Scorer" functionality (generate invite codes/links)
  - [ ] Update API permissions to allow multiple scorers per game
  - [ ] Add scorer presence indicators (show active scorers in UI)
  - [ ] Implement role-based permissions (owner vs co-scorer)
  - [ ] Add activity attribution (show which scorer performed each action)
  - [ ] Build "Join as Scorer" flow (enter game code or use invite link)

- [ ] **5.3 Conflict Resolution**:
  - [ ] Implement optimistic concurrency control for game state updates
  - [ ] Add version/timestamp fields to detect stale updates
  - [ ] Create conflict notification UI (when two scorers edit simultaneously)
  - [ ] Add atomic operations for critical actions (end game, period transitions)

## Phase 6: Stats & Finalization
- [ ] 6.1 Game Summary
- [ ] 6.2 Season Statistics

## Phase 7: Community & Advanced User System (New)
- [ ] **7.1 Database Schema Migration**:
  - [ ] Create `communities`, `community_members`, `community_invites` tables.
  - [ ] Create `user_activity_logs` table.
  - [ ] Add `communityId` to `teams` and `games`.
- [ ] **7.2 Community Management API**:
  - [ ] CRUD routes for Communities.
  - [ ] Invite system (Generate token, Send email - *mock for MVP*, Accept invite).
  - [ ] Member management (Promote/Demote/Remove).
- [ ] **7.3 Permission Middleware**:
  - [ ] Update `auth()` checks to respect Community Roles.
  - [ ] Implement `canManageGame(userId, gameId)` logic.
- [ ] **7.4 Frontend - Community Hub**:
  - [ ] "Create Community" flow.
  - [ ] Community Dashboard (Games, Teams, Members lists).
  - [ ] User Profile Page (My Communities, Invites).
- [ ] **7.5 Activity Logging**:
  - [ ] Create utility function `logActivity()`.
  - [ ] Integrate logging into key API routes (Game Create, Score Update).
