# Basketball Scoring App - Optimal Technical Specification

## 1. Executive Summary
This document outlines the **optimal technical stack** to build a high-performance, real-time, mobile-first basketball scoring application. The choices prioritize **low latency**, **reliability**, **responsiveness**, and **slick user interactions**.

## 2. Core Architecture
**Monorepo-style structure** within a Next.js application, using a custom Node.js server entry point to handle both HTTP (Next.js) and WebSockets (Socket.io) on the same port.

- **Framework**: **Next.js 14+ (App Router)**
  - *Why*: Best-in-class generic web framework. Server Components reduce bundle size for the initial load, while Client Components handle the rich interactivity.
- **Language**: **TypeScript** (Strict Mode)
  - *Why*: Essential for complex state logic (game clocks, event types, player tracking) to prevent runtime errors.

## 3. Frontend Stack (The "Slick" Experience)

### 3.1 UI & Styling
- **Styling Engine**: **Tailwind CSS**
  - *Why*: Instant utility classes, easy mobile-first breakpoints (`touch-target`, `min-h-screen`).
- **Component Library**: **Shadcn UI** (Radix Primitives)
  - *Why*: Accessible, keyboard navigable, and fully customizable. Not a "black box" library; we own the code.
- **Icons**: **Lucide React**
  - *Why*: Clean, consistent, and lightweight vector icons.

### 3.2 Interactivity & Animation
- **Animations**: **Framer Motion**
  - *Why*: The "slick" feel comes from micro-interactions. Layout transitions (list reordering), modal enter/exit, and button scale on tap are trivial with Framer Motion.
- **Drag & Drop**: **@dnd-kit/core**
  - *Why*: Superior touch support compared to older libraries. Essential for the "Drag player to sub" feature.
- **Touch Gestures**: **use-gesture** (optional, but good for swiping).

### 3.3 State Management
- **Client State**: **Zustand**
  - *Why*: Extremely lightweight (~1KB). No boilerplate. Perfect for tracking the local "optimistic" game state (clock, score) before the server confirms.

## 4. Backend & Realtime Stack

### 4.1 Realtime Engine
- **Protocol**: **Socket.io** (v4)
  - *Why*: Automatic reconnection logic, room support (game rooms), and reliable fallbacks. Raw WebSockets are too bare-metal; we need resilience for mobile networks.
- **Server**: **Custom Node.js Server** (Express + Next.js Custom Server)
  - *Why*: Combining Next.js and Socket.io in one process simplifies deployment for improved latency (no jumping between serverless functions and a separate socket server).

### 4.2 Database
- **Database**: **PostgreSQL**
  - *Why*: Relational data (Games -> Teams -> Players -> Events) requires strong consistency.
- **ORM**: **Drizzle ORM**
  - *Why*: Faster and lighter than Prisma. "SQL-like" syntax makes it easy to understand the underlying queries. Great TypeScript inference.

### 4.3 Authentication & User Management
- **Service**: **Clerk**
- **Providers**: Google OAuth (Social Login), Email/Password.
- *Why*: Best-in-class developer experience for Next.js. Provides complete, pre-built high-quality UI components for Login, Registration, and **User Profile Management**. Removes the need to build a custom Admin dashboard for user roles.
- **Integration**: Middleware protects Scorer routes (`clerkMiddleware`).

### 4.4 Testing Strategy
- **Framework**: **Vitest** (Native support for Next.js/Vite environment).
- **Scope**:
  - **Unit Tests**: Mandatory for all `services/` (e.g., `scoring.ts`, `clock.ts`).
  - **Integration Tests**: API Routes (`POST /api/games`) using mocked database.
  - **E2E Tests**: (Optional for MVP) Playwright.

## 5. Data Schema Strategy

### 5.1 Auth Schema (Clerk Managed)
- We do **not** persist users in our DB manually. We use the `auth()` helper to get the `userId` in API routes and store that string in our `Games` table (`owner_id`).
- *Optional*: Webhooks can sync Clerk users to a local `users` table if complex relational queries are needed later, but for MVP we store the `clerk_user_id` directly on records.

### 5.2 Database Schema (PostgreSQL + Drizzle)

#### Core Entities
- **Teams**
  - `id`: UUID
  - `owner_id`: String (Clerk ID)
  - `name`: String
  - `short_code`: String (3 chars)
  - `color`: String (Hex)

- **Athletes** (Global Player Registry)
  - `id`: UUID
  - `owner_id`: String
  - `name`: String

- **TeamMemberships** (Player History)
  - `id`: UUID
  - `team_id`: UUID (FK Teams)
  - `athlete_id`: UUID (FK Athletes)
  - `number`: String (Jersey #)
  - `start_date`: Date
  - `end_date`: Date (Nullable)
  - `is_active`: Boolean

#### Game Entities
- **Games**
  - `id`: UUID
  - `home_team_id`: UUID (FK Teams, Nullable)
  - `guest_team_id`: UUID (FK Teams, Nullable)
  - `home_score`, `guest_score`, `status`...

- **GameRosters** (Snapshot for a specific game)
  - `id`: UUID
  - `game_id`: UUID
  - `team_side`: Enum (Home/Guest)
  - `athlete_id`: UUID (FK Athletes, Nullable for ad-hoc)
  - `name`: String (Snapshot)
  - `number`: String (Snapshot)
  - `stats`: JSONB (Points, Fouls, etc.)

### 5.3 The "Event Stream" Pattern
Instead of just storing the current score, we store an append-only log of **GameEvents**.
- **Table**: `game_events`
- **Fields**: `id`, `game_id`, `type` (SCORE, FOUL, SUB), `payload` (JSON), `timestamp`.
- **Derivation**: The current game state is calculated by reducing these events. This gives us **Undo** functionality for free (just delete the last event) and a perfect **Game Log**.

## 6. Infrastructure & Deployment
- **Containerization**: **Docker & Docker Compose**
  - **Development**: `docker-compose.yml` spins up:
    - **App**: Node.js container (hot-reloading enabled via volumes).
    - **Database**: PostgreSQL 16 container (Alpine).
  - **Production**: Dockerfile builds a lightweight image (multi-stage build) for deployment to any container runtime (Railway, Render, AWS ECS, VPS).
- **Environment**: Strict `.env` management ensures config parity between Docker and Host.

## 7. Mobile-First Requirements (PWA)
- **Manifest**: `manifest.json` for "Add to Home Screen".
- **Viewport**: `viewport-fit=cover` to use the notch area.
- **Touch-Action**: `manipulation` CSS to disable double-tap-to-zoom.

## 8. Summary of Dependencies
```json
{
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "socket.io": "^4.7.0",
    "socket.io-client": "^4.7.0",
    "drizzle-orm": "latest",
    "postgres": "latest",
    "zustand": "latest",
    "framer-motion": "latest",
    "@dnd-kit/core": "latest",
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
