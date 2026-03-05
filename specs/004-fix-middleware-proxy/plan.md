# Implementation Plan: Fix Deprecated Middleware File Convention

**Branch**: `004-fix-middleware-proxy` | **Date**: 2026-03-02 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/004-fix-middleware-proxy/spec.md`

## Summary

Next.js 15 deprecated the `middleware.ts` filename convention in favour of `proxy.ts`. The fix is a single file rename — `src/middleware.ts` → `src/proxy.ts` — with no logic changes. All Clerk auth, route protection, and public-route matching remain identical.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: Next.js 15 (App Router), `@clerk/nextjs`  
**Storage**: N/A  
**Testing**: `npx tsc --noEmit` (type-check); manual smoke-test of server startup  
**Target Platform**: Node.js server (Next.js custom server via `server.ts`)  
**Project Type**: Web application  
**Performance Goals**: N/A — zero runtime change  
**Constraints**: Must not alter route-matching logic or Clerk middleware behaviour  
**Scale/Scope**: Single file rename

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Real-Time First | ✅ Pass | No change to real-time or game state |
| II. Mobile-First | ✅ Pass | No UI change |
| III. Data Integrity | ✅ Pass | No data operations |
| IV. Permission Hierarchy | ✅ Pass | Clerk middleware logic unchanged |
| V. Test Coverage | ✅ Pass | No new business logic; existing tests unaffected |
| VI. TypeScript Strict | ✅ Pass | No type changes |
| VII. Incremental Complexity | ✅ Pass | Simplest possible fix — one rename |

All gates pass. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/004-fix-middleware-proxy/
├── plan.md              # This file
├── research.md          # Phase 0 output (inline below — trivial)
├── tasks.md             # Phase 2 output (/speckit.tasks command)
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (affected files)

```text
src/
├── proxy.ts             # RENAMED from middleware.ts (no content change)
└── middleware.ts        # DELETED (replaced by proxy.ts)
```

**Structure Decision**: Single-file rename at repo root's `src/` level. No new directories, no new dependencies.

## Phase 0: Research

**No external research required.** The Next.js deprecation notice is self-explanatory:

- **Decision**: Rename `src/middleware.ts` → `src/proxy.ts`
- **Rationale**: Next.js 15 changed the conventional filename for request interception from `middleware` to `proxy`. The file content, exports, and `config` matcher are unchanged.
- **Alternatives considered**: Suppressing the warning via Next.js config — rejected because it hides a real deprecation and would break on a future Next.js major.
- **References**: https://nextjs.org/docs/messages/middleware-to-proxy

## Phase 1: Design

No data model changes. No API contract changes. No new entities.

The single implementation action:

```
git mv src/middleware.ts src/proxy.ts
```

File content is **identical** after the rename — no edits to the file body are required.

### Verification

1. `npx tsc --noEmit` — must remain clean (same 2 pre-existing errors in `recalculate/route.ts` and `recalc-toast.tsx`; no new errors).
2. `bun run dev` startup output — must NOT contain "middleware file convention is deprecated".
