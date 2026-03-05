<!-- Sync Impact Report
  Version change: (template) → 1.0.0
  Added sections: Core Principles, Technical Standards, Development Workflow, Governance
  Modified principles: N/A (initial population)
  Templates requiring updates:
    ✅ constitution.md (this file)
    ✅ spec-template.md (aligned)
    ✅ plan-template.md (aligned)
  Follow-up TODOs: none
-->

# HoopHoop Constitution

## Core Principles

### I. Real-Time First

All features that affect live game state MUST propagate changes to all connected clients within 500ms.
The server (Hasura / PostgreSQL) is the single source of truth — no client-authoritative state.
Optimistic UI is permitted for responsiveness but MUST reconcile with server state on confirmation.
Clock synchronization MUST use server timestamps; client-side ticking is a display concern only.

### II. Mobile-First Design

Every scorer interface, player selection widget, and interactive control MUST be fully operable
on mobile portrait (320px minimum width) with touch targets ≥ 48×48px.
Hover-only interactions are FORBIDDEN in scorer flows.
All 6-option player-selection overlays MUST render without scroll on all supported screen sizes.

### III. Data Integrity Over Convenience

Scoring events are append-only; deletion triggers full score recalculation via server-side reduction.
Destructive operations (merge players, delete game, end game) MUST be transaction-based with rollback.
Soft-delete MUST be used everywhere physical delete is tempting (games, players, memberships).
All irreversible admin actions MUST be logged to `user_activity_logs` with actor, resource, and timestamp.

### IV. Permission Hierarchy — Strictly Enforced

Every API route MUST check permissions in this order:
  1. World Admin (`users.isWorldAdmin = true`) → bypass all further checks, log with `WORLD_ADMIN_` prefix.
  2. Community Admin (`community_members.role = 'admin'`) → community-scoped actions allowed.
  3. Resource Owner (`resource.ownerId = userId`) → owner-level access.
  4. Community Role → check `community_members` for scorer/viewer rights.
  5. Default: DENY.
Skipping any step or adding role checks out of order is a violation.

### V. Test Coverage for Business Logic

All service-layer functions in `src/lib/` and `src/server/` MUST have unit tests (Vitest).
API routes with complex permission logic MUST have integration tests with mocked database.
Score recalculation, player merge, timer sync, and permission checks are non-negotiable test targets.
Deleting or skipping failing tests to make CI green is FORBIDDEN.

### VI. TypeScript Strict Mode — No Escape Hatches

`as any`, `@ts-ignore`, and `@ts-expect-error` are FORBIDDEN in application code.
Shared types between web and mobile MUST live in `packages/types` or equivalent shared package.
All Drizzle schema changes MUST include updated TypeScript inference types before merge.

### VII. Incremental Complexity

New features MUST start with the simplest possible implementation.
Adding a new external service requires explicit justification over using Hasura/PostgreSQL/Clerk.
The React Native mobile app scope is intentionally limited to Simple Scorer + game creation until
the web platform reaches stability — scope creep into mobile is a violation.

## Technical Standards

**Web Framework**: Next.js 15 (App Router) — Server Components for data-fetching, Client Components for interactivity.
**Mobile Framework**: React Native + Expo (managed workflow) — suspended until web stability milestone.
**Database**: PostgreSQL 16 via Drizzle ORM (strict TypeScript inference required).
**Real-Time**: Hasura GraphQL WebSocket subscriptions — Socket.io and Convex are removed and MUST NOT be re-introduced.
**Auth**: Clerk (Google OAuth + email/password) — `@clerk/nextjs` on web, `@clerk/clerk-expo` on mobile.
**State Management**: Zustand — shared store logic extracted to `packages/shared` for web/mobile reuse.
**Animations**: Framer Motion (web), React Native Reanimated (mobile).
**Styling**: Tailwind CSS (web), NativeWind (mobile).
**Testing**: Vitest + @testing-library/react (web unit/integration), Jest + @testing-library/react-native (mobile).
**CI/CD**: GitHub Actions — lint + type-check + tests on PR; EAS Build on merge to main for mobile (when active).

**Performance Targets**:
- Scorer → Spectator update latency: < 500ms p95.
- Concurrent scorers per game: ≥ 5 without degradation.
- Timer sync accuracy: all clients within 1 second of each other.
- Page load (scorer interface): < 2s on 4G mobile.

**Security Baselines**:
- Row-Level Security enforced at Hasura permission layer (anonymous: SELECT only on public tables).
- No secrets committed; all credentials via environment variables.
- Player claim requests require admin approval before `athletes.userId` is set.
- `isWorldAdmin` flag is the ONLY escalation path — no hardcoded user IDs in permission logic.

## Development Workflow

**Branch naming**: `[NNN]-short-description` (e.g., `001-tournament-standings`).
**Spec-first**: Features begin with `/speckit.specify` → `/speckit.clarify` → `/speckit.plan` → `/speckit.tasks` → `/speckit.implement`.
**Database migrations**: All schema changes via Drizzle migration files in `drizzle/`; never modify production schema directly.
**API changes**: REST endpoints follow existing patterns in `src/app/api/`; breaking changes require version bump or migration path.
**Hasura metadata**: Any tracked table additions MUST be exported to `hasura/metadata/` and committed.
**Activity logging**: Every state-changing API action MUST call `logActivity()` with appropriate action type.
**Commit messages**: Conventional Commits format (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`).

## Governance

This constitution supersedes all other practices described in `spec/` documents.
Amendments require: documented rationale, version bump, propagation to dependent templates, and commit.
All PRs touching game scoring, permission logic, or database schema MUST reference a spec or constitution article.
Violations of Principles I–VII found in code review MUST be remediated before merge — no exceptions.
Complexity beyond the defined tech stack requires a written justification appended to `spec/technical.md`.

**Version**: 1.0.0 | **Ratified**: 2026-02-28 | **Last Amended**: 2026-02-28
