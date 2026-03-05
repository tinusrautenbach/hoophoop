# Tasks: Fix Deprecated Middleware File Convention

**Input**: Design documents from `/specs/004-fix-middleware-proxy/`
**Prerequisites**: plan.md ✅, spec.md ✅

**Organization**: Single user story (US1 — Clean Server Startup). No setup or foundational phase needed — this is a one-step rename with no dependencies.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: User Story 1 — Clean Server Startup (Priority: P1) 🎯 MVP

**Goal**: Rename `src/middleware.ts` → `src/proxy.ts` so Next.js 15 no longer emits the deprecation warning on startup.

**Independent Test**: Run `bun run dev` and confirm the startup output does NOT contain "middleware file convention is deprecated". Confirm protected routes still redirect unauthenticated users and public routes remain accessible.

### Implementation

- [x] T001 [US1] Rename src/middleware.ts → src/proxy.ts using `git mv src/middleware.ts src/proxy.ts` (no content changes)

### Verification

- [x] T002 [US1] Run `npx tsc --noEmit` and confirm no new TypeScript errors are introduced (2 pre-existing errors in recalculate/route.ts and recalc-toast.tsx are expected and acceptable)
- [x] T003 [US1] Start dev server with `bun run dev` and confirm startup output contains no "middleware file convention is deprecated" warning

---

## Dependencies & Execution Order

- T001 must complete before T002 and T003
- T002 and T003 can run in parallel after T001

---

## Implementation Strategy

### MVP (this feature IS the MVP)

1. Complete T001: `git mv src/middleware.ts src/proxy.ts`
2. Complete T002: `npx tsc --noEmit` — no new errors
3. Complete T003: `bun run dev` — no deprecation warning
4. Commit: `fix: rename middleware.ts to proxy.ts (Next.js 15 convention)`
