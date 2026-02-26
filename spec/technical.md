# Basketball Scoring App - Optimal Technical Specification

## 1. Executive Summary
This document outlines the **optimal technical stack** to build a high-performance, real-time, mobile-first basketball scoring application. The choices prioritize **low latency**, **reliability**, **responsiveness**, and **slick user interactions**. The platform spans a **Next.js web app** and a **React Native mobile app**, sharing types and API contracts.

## 2. Core Architecture
**Monorepo structure** encompassing a Next.js web application and a React Native mobile application. Real-time functionality is provided via **Hasura GraphQL WebSocket subscriptions**, replacing the previous Socket.io custom server approach.

- **Framework (Web)**: **Next.js 14+ (App Router)**
  - *Why*: Best-in-class generic web framework. Server Components reduce bundle size for the initial load, while Client Components handle the rich interactivity.
- **Framework (Mobile)**: **React Native + Expo (Managed Workflow)**
  - *Why*: Share TypeScript types and Zustand stores with the web app. Expo simplifies builds and app store submissions.
- **Language**: **TypeScript** (Strict Mode)
  - *Why*: Essential for complex state logic (game clocks, event types, player tracking) to prevent runtime errors. Shared across web and mobile.

## 3. Frontend Stack (The "Slick" Experience)

### 3.1 UI & Styling (Web)
- **Styling Engine**: **Tailwind CSS**
  - *Why*: Instant utility classes, easy mobile-first breakpoints (`touch-target`, `min-h-screen`).
- **Component Library**: **Shadcn UI** (Radix Primitives)
  - *Why*: Accessible, keyboard navigable, and fully customizable. Not a "black box" library; we own the code.
- **Icons**: **Lucide React**
  - *Why*: Clean, consistent, and lightweight vector icons.

### 3.2 Interactivity & Animation (Web)
- **Animations**: **Framer Motion**
  - *Why*: The "slick" feel comes from micro-interactions. Layout transitions (list reordering), modal enter/exit, and button scale on tap are trivial with Framer Motion.
- **Drag & Drop**: **@dnd-kit/core**
  - *Why*: Superior touch support compared to older libraries. Essential for the "Drag player to sub" feature.
- **Touch Gestures**: **use-gesture** (optional, but good for swiping).

### 3.3 State Management (Shared)
- **Client State**: **Zustand**
  - *Why*: Extremely lightweight (~1KB). No boilerplate. Perfect for tracking the local "optimistic" game state (clock, score) before the server confirms.
  - **Shared**: Zustand store definitions (game state, scoring logic) are extracted into a shared package and used by both web and mobile.

### 3.4 Mobile App Stack (React Native)
- **Framework**: **React Native + Expo** (Managed Workflow)
  - *Why*: Fastest path to both app stores. Expo handles native build toolchains, OTA updates, and provides EAS for CI/CD.
- **Navigation**: **React Navigation** (`@react-navigation/native`)
  - *Why*: Standard navigation for React Native with stack, tab, and modal navigators.
- **UI Components**: **React Native Paper** or custom components styled with **NativeWind** (Tailwind CSS for React Native)
  - *Why*: NativeWind allows sharing mental model with the web Tailwind CSS approach.
- **Animations**: **React Native Reanimated** + **React Native Gesture Handler**
  - *Why*: 60fps native animations and gesture handling for the scoring interface.
- **Auth**: **@clerk/clerk-expo**
  - *Why*: Same auth provider as web, sharing user accounts seamlessly.
- **Real-Time**: **Hasura GraphQL WebSocket** (`graphql-ws` client)
  - *Why*: Same Hasura subscription protocol, sharing GraphQL schema and real-time behavior with the web app.

## 4. Backend & Realtime Stack

### 4.1 Realtime Engine
- **Protocol**: **Hasura GraphQL Subscriptions** (via `graphql-ws`)
  - *Why*: Declarative subscriptions over WebSockets. No custom server required — Hasura handles room management, pub/sub fanout, and reconnection. Scales horizontally without code changes.
- **Server**: **Hasura** (deployed via Docker, connected to PostgreSQL)
  - *Why*: Hasura tracks table changes and pushes subscription updates automatically. Eliminates the need for a custom Node.js WebSocket server.
- **Frontend Client**: `src/components/HasuraProvider.tsx` + `src/hooks/use-hasura-game.ts`
  - *Why*: `HasuraProvider` injects the Clerk JWT into every WebSocket connection. `useHasuraGame` provides a unified interface for subscriptions and mutations.
- **Public Dashboard**: Public games visible via anonymous read permissions on `gameStates` table — no special rooms needed.
### 4.2 Centralized Timer Architecture (Multi-Scorer Support)
To support multiple simultaneous scorers, the game clock is managed via a shared `timerSync` table in PostgreSQL, observed via Hasura subscription:

**Timer State Storage**: PostgreSQL `timer_sync` table stores:
- `isRunning` (boolean): Whether the clock is currently running
- `startedAt` (timestamp, nullable): When the timer was last started (for accurate elapsed calculation)
- `initialClockSeconds` (integer): Clock value when timer was started
- `currentClockSeconds` (integer): Persisted clock for stopped state

**Timer Update Flow:**
```
Scorer clicks "Start"
  → GraphQL mutation: CONTROL_TIMER_MUTATION (sets isRunning=true, startedAt=now)
  → Hasura updates timer_sync row in PostgreSQL
  → All subscribers receive updated timerSync via subscription
  → Clients compute current clock as: initialClockSeconds - (now - startedAt)
```

**Benefits:**
- All scorers and spectators see identical clock times
- Clock continues accurately even if scorer disconnects (computed from DB timestamp)
- No clock drift between clients
- Clean conflict resolution (server DB is authority)

**Benefits:**
- All scorers and spectators see identical clock times
- Clock continues accurately even if scorer disconnects
- No clock drift between clients
- Clean conflict resolution (server is authority)

### 4.3 Multi-Scorer Synchronization
**Hasura Subscription-Based Sync:**
- Each client subscribes to `gameStates(where: { gameId: { _eq: $gameId } })`
- Mutations write to `game_states` table; Hasura broadcasts to all subscribers automatically
- Broadcast pattern is handled by Hasura — no custom room management needed

**State Synchronization Strategy:**
- **Optimistic Updates**: Client applies changes immediately, mutation confirms with DB
- **Conflict Resolution**: Server uses last-write-wins for most fields (upsert with `on_conflict`)
- **Event Sourcing**: All scoring events are append-only via `hasura_game_events` table
- **Score Recalculation**: When a scoring event is deleted, the REST API re-reduces remaining events, updates `games` table, and the Hasura subscription on `gameStates` propagates updated totals
- **Heartbeat**: Presence tracked via subscription connection state
**Permission System:**
- Game ownership tracked in `games.ownerId` field
- Co-scorers stored in separate `game_scorers` table (gameId, userId, role, joinedAt)
- Middleware validates scorer permissions before processing commands
- **World Admin bypass**: If `user.isWorldAdmin === true`, all permission checks pass

### 4.4 Database
- **Database**: **PostgreSQL**
  - *Why*: Relational data (Games -> Teams -> Players -> Events) requires strong consistency.
- **ORM**: **Drizzle ORM**
  - *Why*: Faster and lighter than Prisma. "SQL-like" syntax makes it easy to understand the underlying queries. Great TypeScript inference.

### 4.5 Authentication & User Management
- **Service**: **Clerk**
- **Providers**: Google OAuth (Social Login), Email/Password.
- *Why*: Best-in-class developer experience for Next.js. Provides complete, pre-built high-quality UI components for Login, Registration, and **User Profile Management**. Removes the need to build a custom Admin dashboard for user roles.
- **Integration**:
  - **Web**: Middleware protects Scorer routes (`clerkMiddleware`).
  - **Mobile**: `@clerk/clerk-expo` provides native auth flows.
  - **Shared Sessions**: Same Clerk application serves both web and mobile, so users have a single account.

### 4.6 Testing Strategy
- **Framework**: **Vitest** (Native support for Next.js/Vite environment).
- **Scope**:
  - **Unit Tests**: Mandatory for all `services/` (e.g., `scoring.ts`, `clock.ts`).
  - **Integration Tests**: API Routes (`POST /api/games`) using mocked database.
  - **E2E Tests**: (Optional for MVP) Playwright (web), Detox (mobile).
  - **Mobile Tests**: Jest + React Native Testing Library for component tests.

### 4.7 Community & User Architecture

**Database Schema Additions:**

1.  **Communities Table** (`communities`)
    - `id`: UUID (PK)
    - `name`: String (e.g., "Lincoln High")
    - `slug`: String (unique, URL-friendly — for community portal URLs, e.g., "lincoln-high")
    - `type`: Enum (school, club, league, other)
    - `ownerId`: String (Clerk User ID)
    - `createdAt`: Timestamp

2.  **Community Members Table** (`community_members`)
    - `id`: UUID (PK)
    - `communityId`: UUID (FK)
    - `userId`: String (Clerk User ID)
    - `role`: Enum (admin, scorer, viewer)
    - `canManageGames`: Boolean (Default: true for scorers/admins)
    - `joinedAt`: Timestamp

3.  **Community Invites Table** (`community_invites`)
    - `id`: UUID (PK)
    - `communityId`: UUID (FK)
    - `email`: String
    - `role`: Enum (admin, scorer, viewer)
    - `token`: String (Unique invite code)
    - `status`: Enum (pending, accepted, expired)
    - `expiresAt`: Timestamp

4.  **User Activity Log Table** (`user_activity_logs`)
    - `id`: UUID (PK)
    - `userId`: String (Actor)
    - `communityId`: UUID (Optional, if action is community-scoped)
    - `action`: String (e.g., "GAME_CREATED", "SCORE_UPDATE", "MEMBER_INVITED", "WORLD_ADMIN_ACTION")
    - `resourceType`: String (e.g., "game", "team", "community", "player")
    - `resourceId`: String (ID of the affected object)
    - `details`: JSONB (Snapshot of change or metadata)
    - `ipAddress`: String (Optional, for security)
    - `createdAt`: Timestamp

**Entity Ownership Updates:**
- `teams` and `games` tables need a nullable `communityId` column.
- `games` table needs a `visibility` column: Enum ('private', 'public_general', 'public_community').
- If `communityId` is present, access control checks `community_members` table.
- If `communityId` is null, it's a private resource (check `ownerId`).
- World Admin (`users.isWorldAdmin = true`) bypasses all ownership/membership checks.

### 4.8 World Admin & Permission Architecture

**Permission Check Hierarchy:**
All API routes and GraphQL mutations follow this permission check order:
1. **World Admin Check**: If `user.isWorldAdmin === true` → ALLOW (bypass all further checks). Log action with `WORLD_ADMIN` prefix.
2. **Community Admin Check**: If user has `role: 'admin'` in the relevant community → ALLOW for community-scoped actions.
3. **Resource Owner Check**: If `resource.ownerId === userId` → ALLOW.
4. **Community Role Check**: Check `community_members` table for appropriate role.
5. **Default**: DENY.

**World Admin API Routes:**
- All prefixed under `/api/admin/`.
- Protected by middleware that checks `users.isWorldAdmin`.
- Actions include: user management, player world-availability toggles, force-end games, system-wide activity logs.

**Player Merge Logic (Technical):**
- Transaction-based: All reassignments happen in a single database transaction.
- Steps:
  1. Update `team_memberships SET athlete_id = primaryId WHERE athlete_id = duplicateId`.
  2. Update `game_rosters SET athlete_id = primaryId WHERE athlete_id = duplicateId`.
  3. Update `athletes SET status = 'merged', mergedIntoId = primaryId WHERE id = duplicateId`.
  4. Insert `player_history` record documenting the merge.
  5. Commit transaction.
- Rollback on any failure to maintain data integrity.

## 5. Data Schema Strategy

### 5.1 Auth Schema (Clerk Managed)
- We do **not** persist users in our DB manually. We use the `auth()` helper to get the `userId` in API routes and store that string in our `Games` table (`owner_id`).
- *Optional*: Webhooks can sync Clerk users to a local `users` table if complex relational queries are needed later, but for MVP we store the `clerk_user_id` directly on records.
- **Users Table Enhancement**: The `users` table now includes:
  - `isWorldAdmin`: Boolean (default false) — grants god-mode access.
  - Synced from Clerk on first login via webhook.

### 5.2 Database Schema (PostgreSQL + Drizzle)

#### Core Entities
- **Teams**
  - `id`: UUID
  - `owner_id`: String (Clerk ID)
  - `communityId`: UUID (FK Communities, Nullable)
  - `name`: String
  - `short_code`: String (3 chars)
  - `color`: String (Hex)

- **Athletes** (Global Player Registry)
  - `id`: UUID
  - `owner_id`: String
  - `firstName`: String (required)
  - `surname`: String (required)
  - `name`: String (computed/legacy: firstName + surname)
  - `birthDate`: Date (required for new players)
  - `email`: String (optional)
  - `communityId`: UUID (FK Communities, Nullable)
  - `isWorldAvailable`: Boolean (default false)
  - `status`: Enum (active, inactive, transferred, merged)
  - `mergedIntoId`: UUID (FK Athletes, Nullable)

- **TeamMemberships** (Player History)
  - `id`: UUID
  - `team_id`: UUID (FK Teams)
  - `athlete_id`: UUID (FK Athletes)
  - `number`: String (Jersey #)
  - `start_date`: Date
  - `end_date`: Date (Nullable)
  - `is_active`: Boolean
  - `communityId`: UUID (FK Communities, Nullable)
  - `createdBy`: String (Clerk User ID)
  - `notes`: String (Nullable)

#### Game Entities
- **Games**
  - `id`: UUID
  - `home_team_id`: UUID (FK Teams, Nullable)
  - `guest_team_id`: UUID (FK Teams, Nullable)
  - `communityId`: UUID (FK Communities, Nullable)
  - `visibility`: Enum ('private', 'public_general', 'public_community')
  - `home_score`, `guest_score`, `status`...

- **GameRosters** (Snapshot for a specific game)
  - `id`: UUID
  - `game_id`: UUID
  - `team_side`: Enum (Home/Guest)
  - `athlete_id`: UUID (FK Athletes, Nullable for ad-hoc)
  - `name`: String (Snapshot)
  - `number`: String (Snapshot — can be updated mid-game via Amend Roster)
  - `isActive`: Boolean (whether player was selected for this game's bench; default true)
  - `stats`: JSONB (Points, Fouls, etc.)

### 5.3 The "Event Stream" Pattern
Instead of just storing the current score, we store an append-only log of **GameEvents**.
- **Table**: `game_events`
- **Fields**: `id`, `game_id`, `type` (SCORE, FOUL, SUB), `payload` (JSON), `timestamp`.
- **Derivation**: The current game state is calculated by reducing these events. This gives us **Undo** functionality for free (just delete the last event) and a perfect **Game Log**.
- **Score Recalculation**: When any SCORE event is deleted, the API must re-reduce all remaining SCORE events to compute the correct `home_score` and `guest_score`, update the `games` table, and trigger a Hasura subscription update so all connected clients see the recalculated totals.

## 6. Infrastructure & Deployment

### 6.1 Web Application
- **Containerization**: **Docker & Docker Compose**
  - **Development**: `docker-compose.yml` spins up:
    - **App**: Node.js container (hot-reloading enabled via volumes).
    - **Database**: PostgreSQL 16 container (Alpine).
  - **Production**: Dockerfile builds a lightweight image (multi-stage build) for deployment to any container runtime (Railway, Render, AWS ECS, VPS).
- **Environment**: Strict `.env` management ensures config parity between Docker and Host.

### 6.2 Mobile Application (React Native + Expo)
- **Build System**: **Expo Application Services (EAS)**
  - **EAS Build**: Cloud-based native builds for Android (APK/AAB) and iOS (IPA).
  - **EAS Submit**: Automated submission to Google Play Store and Apple App Store.
  - **EAS Update**: Over-the-air JS bundle updates for non-native changes.
- **Project Structure**:
  ```
  /
  ├── src/                    # Next.js web app (existing)
  ├── mobile/                 # React Native app (new)
  │   ├── app/                # Expo Router screens
  │   ├── components/         # Mobile-specific components
  │   ├── stores/             # Zustand stores (imports from shared)
  │   ├── app.json            # Expo config
  │   ├── eas.json            # EAS Build config
  │   └── package.json        # Mobile dependencies
  ├── packages/
  │   └── shared/             # Shared TypeScript types, constants, store logic
  │       ├── types/          # Game, Player, Team interfaces
  │       ├── constants/      # Scoring rules, event types
  │       └── stores/         # Zustand store definitions (framework-agnostic)
  └── package.json            # Root workspace
  ```
- **CI/CD Pipeline** (GitHub Actions):
  - **On PR**: Lint + type-check + unit tests (web and mobile).
  - **On merge to develop**: EAS Build preview (internal distribution).
  - **On merge to main**: EAS Build production + EAS Submit to stores.
  - **On release tag**: Final store submission with release notes.
- **Android Specifics**:
  - Signing keystore managed via EAS credentials.
  - `app.json` configured with `android.package`, `android.versionCode`, `android.permissions`.
  - Google Play Console service account for automated submission.
- **iOS Specifics**:
  - Provisioning profiles and certificates managed via EAS credentials.
  - `app.json` configured with `ios.bundleIdentifier`, `ios.buildNumber`.
  - App Store Connect API key for automated submission.
  - TestFlight configured for beta distribution.

## 7. Mobile-First Requirements

### 7.1 Web PWA
- **Manifest**: `manifest.json` for "Add to Home Screen".
- **Viewport**: `viewport-fit=cover` to use the notch area.
- **Touch-Action**: `manipulation` CSS to disable double-tap-to-zoom.

### 7.2 Native App (React Native)
- **Target Platforms**: Android 8+ (API 26), iOS 15+.
- **Minimum Screen Support**: 320px width (iPhone SE).
- **Scoring Layout Constraint**: The 6-player scoring selector (5 own team + 1 opponent) must render within the viewport without scrolling on all supported screen sizes. Use responsive grid: 3x2 or 2x3 depending on orientation.
- **Offline Resilience**: Queue scoring events locally if network drops; sync when reconnected (post-MVP enhancement).
- **Push Notifications** (future): Game start reminders, score alerts for followed games.

## 8. Summary of Dependencies

### 8.1 Web Application
```json
{
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "graphql-ws": "^6.0.7",
    "graphql-request": "latest",
    "drizzle-orm": "latest",
    "postgres": "latest",
    "zustand": "latest",
    "framer-motion": "latest",
    "@dnd-kit/core": "latest",
    "react-qr-code": "latest",
    "@clerk/nextjs": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest"
  },
  "devDependencies": {
    "vitest": "latest",
    "@testing-library/react": "latest",
    "@testing-library/dom": "latest"
  }
}
```

### 8.2 Mobile Application
```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "react-native": "latest",
    "react": "latest",
    "@clerk/clerk-expo": "latest",
    "@react-navigation/native": "latest",
    "@react-navigation/native-stack": "latest",
    "graphql-ws": "^6.0.7",
    "zustand": "latest",
    "react-native-reanimated": "latest",
    "react-native-gesture-handler": "latest",
    "react-native-safe-area-context": "latest",
    "react-native-screens": "latest",
    "nativewind": "latest",
    "expo-secure-store": "latest",
    "@react-native-async-storage/async-storage": "latest"
  },
  "devDependencies": {
    "jest": "latest",
    "@testing-library/react-native": "latest",
    "typescript": "latest"
  }
}
```

### 8.3 Shared Package
```json
{
  "dependencies": {},
  "devDependencies": {
    "typescript": "latest"
  }
}
```
