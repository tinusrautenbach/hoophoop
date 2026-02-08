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
  - [x] **3.2.2 Game Log**: 
    - [x] Vertical feed at bottom (showing last 10 entries).
    - [x] Expandable action items.
    - [x] Edit/Delete modal for individual events.
  - [x] **3.2.3 Status Indicators**: Possession arrow, Foul Count alerts (Bonus indicators).
  - [x] **3.2.4 Points-First Flow**: Support for clicking points then selecting player/team.
- [ ] **3.3 Roster Enforcement & Positioning**:
  - [x] Auto-populate game roster from team ID on game creation (API).
  - [ ] Enforce roster requirement on game start button.
  - [ ] Logic to ensure owner's team is always Home (Left).

## Phase 4: Share & Public Views (Done)
- [x] 4.1 Live Scoreboard (Public)
- [x] 4.2 QR Code Sharing

## Phase 5: Multi-Scorer & Centralized Timer (Partially Done)
- [x] **5.1 Centralized Timer Architecture**:
  - [x] Create server-side timer service in Socket.io handler
  - [x] Add `timerStartedAt` timestamp field to games table
  - [x] Implement timer start/stop commands ('timer-control' socket events)
  - [x] Server broadcasts clock updates every second to all room members
  - [x] Persist timer state to database on start/stop
  - [x] Remove client-side timer ticking (all timing comes from server)
  - [x] Add server-side timer recovery on restart (via join-game logic)
  
- [ ] **5.2 Multi-Scorer Support**:
  - [x] Create `game_scorers` table
  - [ ] Add "Invite Scorer" UI functionality
  - [x] Update API permissions to allow multiple scorers per game
  - [ ] Add scorer presence indicators (show active scorers in UI)
  - [x] Implement role-based permissions (API level)
  - [ ] Add activity attribution (track which scorer performed each action)
  - [ ] Build "Join as Scorer" flow UI

- [ ] **5.3 Conflict Resolution**:
  - [ ] Implement optimistic concurrency control for game state updates
  - [ ] Add version/timestamp fields to detect stale updates
  - [ ] Create conflict notification UI (when two scorers edit simultaneously)
  - [x] Add atomic operations for critical actions (end game, period transitions via API)

## Phase 6: Stats & Finalization
- [x] 6.1 Game Summary
- [ ] 6.2 Season Statistics

## Phase 7: Community & Advanced User System (NEW)
- [x] **7.0 Social Authentication**:
  - [x] Configure Clerk/Google Social Login.
  - [x] Implement `src/middleware.ts` to protect scorer routes.
  - [x] Replace mock user (e.g., hardcoded 'user_1') with authenticated user ID.
  - [x] Sync auth user with `users` table on first login.
- [x] **7.1 Database Schema Migration**:
  - [x] Create `communities`, `community_members`, `community_invites` tables.
  - [x] Create `user_activity_logs` table.
  - [x] Add `communityId` to `teams` and `games`.
- [ ] **7.2 Community Management API**:
  - [x] CRUD routes for Communities.
  - [ ] Invite system (Generate token, Send email - *mock for MVP*, Accept invite).
  - [ ] Member management (Promote/Demote/Remove).
- [ ] **7.3 Permission Middleware**:
  - [ ] Update `auth()` checks to respect Community Roles.
  - [ ] Implement `canManageGame(userId, gameId)` logic.
- [ ] **7.4 Frontend - Community Hub**:
  - [x] "Create Community" flow.
  - [x] Community Dashboard (Games, Members lists).
  - [ ] Community Dashboard (Teams list).
  - [x] **User Profile Page**:
    - [x] Display personal details and activity.
    - [x] List joined communities.
    - [ ] Manage pending invitations.
    - [x] **Logout functionality**.
- [ ] **7.5 Activity Logging**:
  - [x] Create utility function `logActivity()`.
  - [ ] Integrate logging into key API routes (Game Create, Score Update).

