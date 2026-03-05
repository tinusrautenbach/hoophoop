# Feature Specification: HoopHoop Basketball Scoring Platform

**Feature Branch**: `main` (platform-wide specification)
**Created**: 2026-02-28
**Status**: Active (Phases 1–15 complete; Phases 14 tournament & 18 Hasura partially complete)
**Source**: Derived from `spec/functional.md`, `spec/technical.md`, `spec/implementation_plan.md`

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Live Game Scoring (Priority: P1)

A Scorer (authenticated via Google) creates a new game, selects teams, sets up the bench, and scores
a live basketball game in real-time. All scorers and spectators connected to the game see identical
state (score, clock, fouls, possession) within 500ms of any change.

**Why this priority**: The core value proposition of the platform — without reliable live scoring,
nothing else matters.

**Independent Test**: Create a game, add two teams with rosters, start the clock, record 3 scoring
events, delete one, and verify score recalculation is reflected on a separate spectator browser tab.

**Acceptance Scenarios**:

1. **Given** a logged-in Scorer, **When** they create a game with two teams, **Then** the game
   appears in their game list with status "Scheduled".
2. **Given** a game in "Scheduled" state with at least 1 player per team, **When** Scorer clicks
   "Start Game", **Then** status becomes "Live" and the clock begins.
3. **Given** a live game with 5 on-court players, **When** Scorer taps "+2", **Then** a 6-option
   overlay appears (5 players + 1 opponent) with no scrolling required.
4. **Given** a scoring event in the game log, **When** Scorer deletes it, **Then** team totals
   recalculate atomically and all connected spectators see updated scores within 500ms.
5. **Given** two Scorers connected to the same game, **When** one records a foul, **Then** the
   other Scorer sees the foul count update without refreshing.

---

### User Story 2 — Spectator Real-Time View (Priority: P1)

A spectator (no login required) opens the game link or scans a QR code and sees the live scoreboard
with clock, score, period, fouls, possession, and play-by-play updating in real-time.

**Why this priority**: Spectators are the primary audience for the product's public-facing value.

**Independent Test**: Open the spectator URL for a live game in an incognito browser; verify all
state updates from the scorer appear without page refresh.

**Acceptance Scenarios**:

1. **Given** a public or shared game link, **When** an unauthenticated user opens it, **Then**
   they see the scoreboard without being prompted to log in.
2. **Given** a live game, **When** the scorer stops the clock, **Then** the spectator sees the
   clock stop within 500ms.
3. **Given** a live game, **When** viewed on a 375px-wide mobile screen, **Then** the scoreboard
   is fully legible without horizontal scrolling.

---

### User Story 3 — Team & Player Management (Priority: P2)

A Scorer creates teams, adds players (by searching the global player registry or creating new
profiles), assigns jersey numbers, and builds rosters for future games.

**Why this priority**: Teams and players are the persistent data layer that makes the platform
reusable across games.

**Independent Test**: Create a team, search for an existing player by surname, add them with a
jersey number, create a new player with first name/surname/DOB, then start a game using that team
and verify both players appear in the bench selection screen.

**Acceptance Scenarios**:

1. **Given** a Scorer, **When** they create a team with a name, short code, and color, **Then**
   the team is saved and appears in their team list.
2. **Given** a team edit page, **When** searching for a player by partial surname, **Then**
   results include community-scoped players and "World Available" players, showing Name, DOB,
   and current team(s).
3. **Given** a new player form with First Name, Surname, DOB, and Jersey Number filled, **When**
   submitted, **Then** a new athlete profile is created and linked to the team.
4. **Given** a team with 5 active members, **When** creating a new game using that team, **Then**
   all 5 players appear pre-selected on the bench selection screen.

---

### User Story 4 — Community Management (Priority: P2)

A Community Admin creates a community (e.g., a school or club), invites members, assigns roles
(Admin / Scorer / Viewer), associates teams and games, and monitors activity via the community
dashboard and community portal URL.

**Why this priority**: Communities are the organizational unit that enables multi-team, multi-game
management for schools and clubs.

**Independent Test**: Create a community, invite a user by email, accept the invite as that user,
create a game marked "Public - Community Only", and verify it appears on the community portal URL
but NOT on the World Public Dashboard.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they create a community with a name and slug, **Then** a
   public portal is available at `/community/[slug]`.
2. **Given** a Community Admin, **When** they invite a user by email with role "Scorer", **Then**
   that user can create and score games within the community after accepting.
3. **Given** a game with visibility "Public - Community Only", **When** viewing the world dashboard
   at `/live`, **Then** the game does NOT appear; it only appears on the community portal.
4. **Given** a Community Admin, **When** viewing the community dashboard, **Then** they can see
   all pending player claim requests and approve or reject them.

---

### User Story 5 — Player Profile & Statistics (Priority: P3)

A player (registered user) claims their athlete profile, views lifetime and per-team statistics,
and sees their team membership history.

**Why this priority**: Valuable for retention and engagement but not blocking for core scoring.

**Independent Test**: Invite a player via email, have them accept and claim their profile, then
verify their stats page shows games played, points, and team history.

**Acceptance Scenarios**:

1. **Given** an unclaimed athlete profile, **When** a user clicks "Claim Profile", **Then** a
   claim request with status "pending" is created and the community admin receives an email.
2. **Given** an approved claim, **When** the player visits `/players/[id]`, **Then** they see
   lifetime stats (games, points, fouls, PPG) and team history.
3. **Given** a player with games across two teams, **When** viewing "By Team" stats, **Then**
   stats are correctly segmented per team.

---

### User Story 6 — World Public Dashboard (Priority: P3)

An anonymous visitor opens `https://hoophoop.net/live` and sees all live "Public - General" games
grouped by community, with real-time score updates.

**Why this priority**: Public discoverability — important for growth but not blocking operations.

**Independent Test**: Mark a game as "Public - General" and verify it appears on `/live` with
live score updates visible to an unauthenticated user.

**Acceptance Scenarios**:

1. **Given** a live game marked "Public - General", **When** an unauthenticated user visits `/live`,
   **Then** the game appears with team names, current score, and period/clock.
2. **Given** the live tab on `/live`, **When** a scorer updates the score, **Then** the score
   updates in real-time without page refresh.

---

### User Story 7 — Tournament Management (Priority: P4 / In Development)

A Community Admin creates a tournament, adds teams, assigns them to pools, generates a round-robin
schedule, records scores, and views standings and a knockout bracket.

**Why this priority**: Important for leagues and tournaments but not yet fully implemented — P4.

**Independent Test**: Create a tournament, add 4 teams, manually enter scores for all round-robin
matchups, and verify standings are calculated correctly.

**Acceptance Scenarios**:

1. **Given** a tournament with 4 teams added, **When** the Admin assigns scores for all games,
   **Then** standings update with correct win/loss records.
2. **Given** a tournament with Pool + Knockout format, **When** pool stage completes, **Then**
   a knockout bracket is generated seeded by pool standings.

---

### Edge Cases

- What happens when two scorers simultaneously record conflicting events (e.g., both call timeout)?
  → Last-write-wins for state; atomic append for scoring events; conflict notification shown to both.
- What happens if the scorer's browser disconnects mid-game?
  → Hasura subscription reconnects automatically; clock computed from `timerSync.startedAt` + elapsed.
- What happens when deleting a scoring event for a player who has since been subbed out?
  → Event is still deleted; score recalculation operates on remaining events regardless of roster state.
- What happens if a player profile is claimed by the wrong user and an admin rejects the claim?
  → `athleteId.userId` is NOT set; the athlete remains unlinked; the claim status becomes "rejected".
- What happens when merging two player profiles that both have game_events?
  → All `gameRosters` entries referencing the duplicate are reassigned to the primary in a single transaction; `game_events` are preserved unchanged (they reference roster entries, not athlete IDs directly).
- What happens if a game is force-ended by a World Admin?
  → Status set to "Final"; action logged with `WORLD_ADMIN_FORCE_END` prefix.

---

## Requirements *(mandatory)*

### Functional Requirements

**Game Lifecycle**
- **FR-001**: System MUST allow authenticated Scorers to create games with configurable period length, number of periods, overtime rules, foul limits, and timeout counts.
- **FR-002**: System MUST enforce that a game cannot transition to "Live" until both teams have at least 1 player in their roster (unless game is flagged "adhoc").
- **FR-003**: System MUST provide a bench selection screen where all roster players are pre-selected and the Scorer can deselect absent players before the game goes live.
- **FR-004**: System MUST support a public visibility toggle: Private (default), Public - General, Public - Community Only.
- **FR-005**: System MUST allow Scorers to end a game, setting its status to "Final".

**Live Scoring**
- **FR-006**: When a point value is tapped, the system MUST display exactly 6 options (5 on-court players + 1 opponent button) with no scrolling on any supported screen size.
- **FR-007**: System MUST provide both Simple Scorer mode (home team player tracking only) and Advanced Scorer mode (full stats for both teams).
- **FR-008**: System MUST maintain an append-only game event log; score is derived by reducing all scoring events.
- **FR-009**: When a scoring event is deleted, the system MUST atomically recalculate team totals, persist them, and broadcast updated scores to all connected clients.
- **FR-010**: System MUST provide undo functionality (delete most recent event) accessible via a single tap/click.
- **FR-011**: System MUST support in-game roster amendments: change jersey number, add player, remove player from game roster.

**Real-Time Synchronization**
- **FR-012**: Game clock MUST run on the server (via `timerSync` table); clients compute display time from `timerSync.startedAt` + elapsed.
- **FR-013**: All game state changes (score, fouls, clock, substitutions) MUST be broadcast to all subscribers within 500ms.
- **FR-014**: System MUST show presence indicators for which Scorers are currently active on a game.

**Multi-Scorer**
- **FR-015**: Multiple authorized users MUST be able to score the same game simultaneously, each seeing identical state.
- **FR-016**: System MUST support scorer roles: Owner (full control), Co-Scorer (scoring + subs), Viewer (read-only scorer interface).
- **FR-017**: System MUST attribute each game log action to the scorer who performed it.

**Team & Player Management**
- **FR-018**: Player profiles MUST store: First Name, Surname, Date of Birth (required), Email (optional), and a `isWorldAvailable` flag.
- **FR-019**: Player search MUST support partial match on first name AND/OR surname, scoped to user's community by default, with "World Available" players included regardless of community.
- **FR-020**: System MUST support soft-delete for team memberships (set `endDate`) to preserve historical data.
- **FR-021**: Community Admins MUST be able to merge duplicate player profiles in a single transaction, reassigning all memberships and game rosters to the primary profile.

**Community & Permissions**
- **FR-022**: System MUST enforce the 5-step permission hierarchy defined in the Constitution (World Admin → Community Admin → Resource Owner → Community Role → Deny).
- **FR-023**: Community Admins MUST be able to invite users by email, assign roles, and revoke access.
- **FR-024**: Player claim requests MUST require admin approval; the `athletes.userId` field MUST NOT be set until approval.
- **FR-025**: All state-changing actions MUST be logged to `user_activity_logs` with actor, action type, resource type, resource ID, and timestamp.

**Public Portals**
- **FR-026**: World Public Dashboard at `/live` MUST show all games with visibility "Public - General" to unauthenticated users, with real-time updates.
- **FR-027**: Community Portal at `/community/[slug]` MUST show all games for that community (both "Public - General" and "Public - Community Only"), accessible without login.
- **FR-028**: Private games MUST NOT appear on any public portal.

**Tournaments (Partial)**
- **FR-029**: System MUST allow creating tournaments with type (Round Robin, Single Elimination, Double Elimination, Pool + Knockout Hybrid, Swiss, Group Stage, Custom) and associating teams.
- **FR-030**: System MUST support manual score entry for tournament games not scored live.
- **FR-031**: Tournament standings calculation (pool tables, bracket advancement) is required but currently in development.

### Key Entities

- **Game**: A single basketball game. Has home/guest teams, configurable rules, visibility, status (Scheduled → Live → Final), community association, and an append-only event log.
- **GameEvent**: Append-only record of a scoring/foul/sub/violation event. The current score is derived by reducing these.
- **GameState**: Denormalized current state of a game (score, period, clock direction) — updated via Hasura mutations and subscribed to by all clients.
- **TimerSync**: Server-side timer state (`isRunning`, `startedAt`, `initialClockSeconds`). All clients compute display time from this.
- **Team**: A basketball team with name, short code, color, optional community association. Owned by a user.
- **Athlete**: A global player profile with firstName, surname, birthDate, isWorldAvailable, communityId, status, mergedIntoId.
- **TeamMembership**: Links an Athlete to a Team for a date range, with jersey number. Soft-deleted via `endDate`.
- **GameRoster**: Snapshot of an Athlete on a specific team side for a specific game. Stores jersey number at game time; can be amended mid-game.
- **Community**: An organizational unit (school, club, league). Has a unique slug for the portal URL, members with roles, and associated teams/games.
- **CommunityMember**: Links a User to a Community with a role (admin, scorer, viewer).
- **PlayerClaimRequest**: A pending request to link a user account to an athlete profile; requires admin approval.
- **Season**: A time-bounded competition period within a community. Games and teams can be associated with seasons.
- **Tournament**: A structured competition with multiple games, pools, and brackets.
- **UserActivityLog**: Audit trail for all significant actions.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Scorer-to-spectator update latency is under 500ms for 95% of scoring events under normal load (≤ 5 concurrent scorers per game).
- **SC-002**: The 6-player scoring overlay renders without scroll on all screen widths from 320px to 1280px in both portrait and landscape orientation.
- **SC-003**: Score recalculation after event deletion completes and propagates to all subscribers before the scorer's UI confirms the deletion (no stale state visible).
- **SC-004**: A Scorer can complete game creation, bench selection, and record the first scoring event within 3 minutes from a cold start (no prior familiarity assumed).
- **SC-005**: Player search returns results within 1 second for queries against a database of up to 10,000 athletes.
- **SC-006**: All permission checks correctly enforce the 5-step hierarchy — zero unauthorized data access in integration test suite.
- **SC-007**: Community portal and world dashboard display correct visibility filtering — "Public - Community Only" games never appear on the World Dashboard (zero leakage in test suite).
- **SC-008**: The platform supports at least 5 simultaneous scorers on a single game and at least 100 simultaneous spectators across 10 concurrent live games without degradation.
- **SC-009**: All World Admin actions are logged with `WORLD_ADMIN_` prefix; zero unlogged admin actions in audit tests.
- **SC-010**: Player merge operation completes atomically — partial state (some memberships reassigned, some not) MUST NOT be observable at any point.

---

## Assumptions

- Authentication is handled entirely by Clerk; the platform stores Clerk User IDs in DB records but does not manage passwords.
- "World Available" player flag can only be set by World Admins — no self-service.
- The mobile app (React Native / Expo) is suspended; all current development targets the Next.js web app.
- Socket.io and Convex have been fully removed; Hasura GraphQL WebSocket subscriptions are the only real-time mechanism.
- The primary deployment target is a Docker-based VPS or container runtime; Vercel is NOT the primary target due to the Hasura sidecar requirement.
- Email sending uses Resend (existing integration); no alternative email provider is planned.
- Tournament standings calculation, bracket generation, and awards system are in-development and not yet production-ready.
