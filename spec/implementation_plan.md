# Basketball Scoring App - Implementation Plan

## Phase 1: Project Setup (Docker & Next.js)
**Git Workflow**: Create branch `feature/setup-project` for this phase.
- [ ] **1.1 Initialize Next.js App**: `npx create-next-app@latest . --typescript --tailwind --eslint`.
- [ ] **1.2 Docker Environment**:
  - Create `Dockerfile` (Node.js multi-stage build).
  - Create `docker-compose.yml` defining services:
    - `app` (Next.js custom server).
    - `db` (PostgreSQL 16).
  - Configure `.env` for database connection string.
- [ ] **1.3 Install Dependencies**:
  - App: `@clerk/nextjs`, `socket.io`, `socket.io-client`, `clsx`, `tailwind-merge`, `lucide-react`, `zustand`, `framer-motion`, `@dnd-kit/core`, `react-qr-code`.
  - Dev: `ts-node`, `nodemon` (for custom server dev), `drizzle-orm`, `drizzle-kit`, `postgres`.

## Phase 2: Backend & Database
- [ ] **2.1 Database Setup (Prisma)**:
  - Initialize Prisma: `npx prisma init`
  - Define Schema in `prisma/schema.prisma`: `Game`, `Team`, `Player`, `GameEvent`.
  - Migrate DB: `npx prisma migrate dev --name init`
- [ ] **2.2 Custom Server Setup**:
  - Create `server.ts` or `server.js` to serve Next.js and attach Socket.IO.
  - Configure `nodemon` (or `ts-node-dev`) for development hot-reloading of the backend.
- [ ] **2.3 API Routes**:
  - `POST /api/games`: Create a game (Protected, requires Auth).
  - `GET /api/games/[id]`: Retrieve game state.
  - `socket.on('join-game')`: Handle room joining.
  - `socket.on('update-game')`: Handle game state updates (validation layer).
- [ ] **2.4 Authentication Setup (Clerk)**:
  - Install `@clerk/nextjs`.
  - Set up Clerk Application in Dashboard.
  - Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env`.
  - Create `middleware.ts` with `clerkMiddleware()` to protect scorer routes.
  - Add `<ClerkProvider>` to root layout.
  - Add `<SignIn />` and `<UserButton />` components to the UI.

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
    - Build a "Bench" vs "Court" dnd-kit implementation.
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

## Phase 6: Polish & Refine
- [ ] **5.1 Styling**: Apply a "Varsity" or "Pro" aesthetic (e.g., dark mode, high contrast colors).
- [ ] **5.2 User Feedback**: Add toast notifications for key actions (e.g., "Timeout Home", "Foul Away").
- [ ] **5.3 Deployment Prep**: Ensure build works with custom server logic.

## Phase 6: Incremental Improvements
- [ ] Player Rosters & Substitutions.
- [ ] Detailed Game Log.
- [ ] Shot Chart Input.
