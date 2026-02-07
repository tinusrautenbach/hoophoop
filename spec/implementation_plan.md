# Basketball Scoring App - Implementation Plan

## Phase 1: Project Setup (Docker & Next.js)
**Git Workflow**: Create branch `feature/setup-project` for this phase.
- [x] **1.1 Initialize Next.js App**: `npx create-next-app@latest . --typescript --tailwind --eslint`.
- [x] **1.2 Docker Environment**:
  - Create `Dockerfile` (Node.js multi-stage build).
  - Create `docker-compose.yml` defining services:
    - `app` (Next.js custom server).
    - `db` (PostgreSQL 16).
  - Configure `.env` for database connection string.
- [x] **1.3 Install Dependencies**:
  - App: `@clerk/nextjs`, `socket.io`, `socket.io-client`, `clsx`, `tailwind-merge`, `lucide-react`, `zustand`, `framer-motion`, `@dnd-kit/core`, `react-qr-code`.
  - Dev: `ts-node`, `nodemon` (for custom server dev), `drizzle-orm`, `drizzle-kit`, `postgres`.

## Phase 2: Backend & Database
- [x] **2.1 Database Setup (Prisma)**:
  - Initialize Prisma: `npx prisma init`
  - Define Schema in `prisma/schema.prisma`: `Game`, `Team`, `Player`, `GameEvent`.
  - Migrate DB: `npx prisma migrate dev --name init`
- [x] **2.2 Custom Server Setup**:
  - Create `server.ts` or `server.js` to serve Next.js and attach Socket.IO.
  - Configure `nodemon` (or `ts-node-dev`) for development hot-reloading of the backend.
- [x] **2.3 API Routes**:
  - `POST /api/games`: Create a game (Protected, requires Auth).
  - `GET /api/games/[id]`: Retrieve game state.
  - `socket.on('join-game')`: Handle room joining.
  - `socket.on('update-game')`: Handle game state updates (validation layer).
- [x] **2.4 Authentication Setup (Clerk)**:
  - Install `@clerk/nextjs`.
  - Set up Clerk Application in Dashboard.
  - Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env`.
  - Create `middleware.ts` with `clerkMiddleware()` to protect scorer routes.
  - Add `<ClerkProvider>` to root layout.
  - Add `<SignIn />` and `<UserButton />` components to the UI.

## Phase 2.5: Team & Roster Management (Global Registry)
- [ ] **2.5.1 New Tables (Migration)**:
  - `Teams`: Name, short code, owner.
  - `Athletes`: Global list of players.
  - `TeamMemberships`: Link athletes to teams with date ranges.
  - `GameRosters` (replaces old `players` table): Links game to athlete.
- [x] **2.5.2 API - Team Management**:
  - `POST /api/teams`: Create team.
  - `POST /api/teams/:id/members`: Add athlete to team (create membership).
  - `GET /api/teams`: List user's teams.
- [x] **2.5.3 UI - Team Manager**:
  - A dedicated "My Teams" page.
  - Add Player form (Name + Number).

## Phase 3: Frontend Core (Scorer Views)
- [ ] **3.1 Layout & Mobile Design**:
  - Implement a `MobileLayout` vs `DesktopLayout` utility.
  - Create Scorer Mode Selection (Simple vs Advanced) on Game Create.
- [ ] **3.1.1 Mode A: Simple Scorer UI**:
  - **Home Team Controls**: Buttons initiate a "Who Scored?" modal/overlay for roster selection (Quick access to active players).
  - **Guest Team Controls**: Simple +1, +2, +3 buttons directly increment score.
  - **Fouls**: Individual tracking for Home, Team tracking for Guest.
  - **Game Clock**: Standard controls.
- [ ] **3.1.2 Mode B: Advanced Scorer**:
  - **Slick Sub Interface**:
    - **Visual Bench**: Drag-and-drop (`dnd-kit`) players from Bench list to On-Court slots.
    - **Time Tracking**: Service to calculate time-on-court based on `sub` events and current game clock.
    - Implementing "Tap-to-Swap" logic for mobile speed.
  - Action Palette: Assist, Steal, Block, Rebound, Turnover.
  - Interactive Court: Click-to-plot Shot Chart.
- [ ] **3.2 Shared Components**:
  - `GameClock`: Robust start/stop/edit.
  - `GameLog`: Universal log feed.
  - `ShareGame`: Modal with QR Code (`react-qr-code`) pointing to `basket.ls.co.za/game/[id]` and "Copy Link" button.

## Phase 4: Frontend Spectator View
- [ ] **4.1 Spectator Route**: `/game/[id]/spectator` (or just `/game/[id]`).
- [ ] **4.2 Read-Only Display**:
  - `BigBoard`: Score, Time, Period, Team Fouls count.
  - `PlayByPlay`: Scrollable list of recent game events.
  - `BoxScore`: Tabular view of player stats (Points, Fouls, etc.).
  - `PossessionArrow`: Visual indicator.
- [ ] **4.3 Real-Time Sync**:
  - Hook up `socket.on('game-updated')` to update the View state instantly.

## Phase 5: Testing & QA (Enforced)
- [ ] **5.1 Setup Test Environment**:
  - Install `vitest` and `@testing-library/react`.
  - Configure `vitest.config.ts`.
- [ ] **5.2 Backend Unit Tests**:
  - `services/__tests__/game.test.ts`: Scoring logic, Clock logic, Undo stack.
  - `services/__tests__/socket.test.ts`: Room join/leave, event parsing.
- [ ] **5.3 API Route Tests**:
  - Mock DB calls and verify HTTP responses for Game CRUD.
- [ ] **5.4 Intentional Breaking**:
  - Verify error handling (e.g., submitting score to finalized game).

## Phase 6: Post-Game & Export
- [ ] **6.1 Finalize Game Logic**:
  - API endpoint to close game (`status: 'final'`).
- [ ] **6.2 HTML Export**:
  - Create utility to render current game state (Box Score, Log) into a standalone HTML string.
  - Implement `navigator.share` with a constructed `File` object for WhatsApp/Email sharing on mobile.

## Phase 7: Polish & Refine
- [ ] **7.1 Styling**: Apply a "Varsity" or "Pro" aesthetic (e.g., dark mode, high contrast colors).
- [ ] **7.2 User Feedback**: Add toast notifications for key actions (e.g., "Timeout Home", "Foul Away").
- [ ] **7.3 Deployment Prep**: Ensure build works with custom server logic.

## Phase 8: Incremental Improvements
- [ ] **8.1**: Player Rosters & Substitutions.
- [ ] **8.2**: Detailed Game Log.
- [ ] **8.3**: Shot Chart Input.
