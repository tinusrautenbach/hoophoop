# Implementation Plan: Scorer Page UX Improvements

**Branch**: `080-scorer-ux-improvements` | **Date**: 2026-03-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/080-scorer-ux-improvements/spec.md`

## Summary

Improve the scorer page UI for responsive design across mobile portrait, mobile landscape, tablet, and PC. Focus on: (1) Adding a "quick repeat" shortcut after player scoring to reduce clicks from 3 to 2, (2) Increasing touch target sizes to meet WCAG 2.5.5 minimums, (3) Improving legibility of period/clock displays, (4) Optimizing landscape layout for narrow devices, (5) Adding visual feedback during scoring mutations.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, no escape hatches per constitution) + Next.js 15 (App Router)
**Primary Dependencies**: React 19, Framer Motion, Tailwind CSS, Zustand
**Storage**: N/A (UI changes only, no new data entities)
**Testing**: Vitest + @testing-library/react
**Target Platform**: Mobile web (portrait primary), Tablet (landscape), Desktop (secondary)
**Project Type**: Web application (frontend-focused)
**Performance Goals**: < 100ms visual feedback on user action, < 500ms mutation sync per constitution
**Constraints**: Touch targets ≥ 44×44pt WCAG 2.5.5, real-time propagation < 500ms per constitution
**Scale/Scope**: Single scorer page with 5 user stories affecting ~10 components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Real-Time First | ✅ PASS | Visual feedback adds to existing real-time sync infrastructure |
| II. Mobile-First Design | ✅ PASS | Core requirement aligns with constitution - touch targets ≥ 48×48pt |
| III. Data Integrity Over Convenience | ✅ PASS | Debounce prevents duplicate mutations, maintains data integrity |
| IV. Permission Hierarchy | ✅ PASS | No permission changes, UI-only feature |
| V. Test Coverage | ✅ PASS | Will add Vitest tests for new components and interactions |
| VI. TypeScript Strict Mode | ✅ PASS | No `as any`, `@ts-ignore`, or escape hatches |
| VII. Incremental Complexity | ✅ PASS | Simplest implementation: CSS classes + React state for quick-repeat |

**Gate Status**: ✅ ALL CHECKS PASS - Noviolations

## Project Structure

### Documentation (this feature)

```text
specs/080-scorer-ux-improvements/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (minimal - UI state only)
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── app/game/[id]/scorer/
│   └── page.tsx                     # Main scorer page (modifications)
├── components/scorer/
│   ├── simple-scorer.tsx            # Simple mode (touch target fixes)
│   ├── advanced-scorer.tsx          # Advanced mode (quick-repeat)
│   ├── scoring-modal.tsx            # Player selection (pre-selection)
│   ├── game-log.tsx                 # Event log (icon size fixes)
│   ├── quick-repeat-button.tsx      # NEW: Quick repeat shortcut component
│   └── mutation-feedback.tsx        # NEW: Visual feedback for mutations
├── hooks/
│   └── use-hasura-game.ts           # Mutation state tracking (modifications)
└── styles/
    └── scorer-tailwind.css          # NEW: Touch target constants (optional)

tests/
├── components/scorer/
│   ├── quick-repeat-button.test.tsx # NEW: Unit tests
│   └── mutation-feedback.test.tsx   # NEW: Unit tests
└── e2e/
    └── scorer-ux.spec.ts            # NEW: E2E tests for touch targets
```

**Structure Decision**: Single Next.js app with frontend components. All changes are in `src/components/scorer/` and `src/app/game/[id]/scorer/`. Touch target improvements use Tailwind utility classes directly - no new CSS files needed.

## Complexity Tracking

> No constitution violations - table not needed.

## Phase 0: Research

### Research Questions

1. **What is the current touch target sizing strategy?**
   - Find all interactive elements in scorer components
   - Document current sizes vs WCAG 2.5.5 requirements
   - Identify Tailwind classes to modify

2. **How does the scoring modal handle player selection?**
   - Analyze `ScoringModal` component state flow
   - Determine where to inject pre-selection logic
   - Identify callback patterns for quick-repeat

3. **What is the current mutation feedback implementation?**
   - Check if there's existing loading state infrastructure
   - Identify WebSocket subscription patterns
   - Determine optimistic update behavior

4. **What responsive breakpoints are in use?**
   - Document `landscape:` vs `sm:/md:/lg:` breakpoints
   - Identify where tables diverge from mobile landscape
   - Find opportunities for tablet-specific improvements

5. **What is the debounce strategy for button interactions?**
   - Check for existing debounce patterns
   - Identify where rapid-tap handling is needed
   - Determine Framer Motion animation patterns

## Phase 1: Design

### Data Model

This feature is primarily UI/UX focused with minimal new data entities:

```markdown
## UI State Entities

### LastScorer (new)
- playerId: string | null
- team: 'home' | 'guest' | null
- lastScoreType: 1 | 2 | 3 | null
- expiresAt: 'substitution' | 'timeout' | 'period_end'
```

### Component Changes

| Component | Change Type | Description |
|-----------|-------------|-------------|
| `page.tsx` | Modify | Add lastScorer state, pass to scoring modal |
| `simple-scorer.tsx` | Modify | Increase button padding, fix touch targets |
| `advanced-scorer.tsx` | Modify | Add quick-repeat button, increase touch targets |
| `scoring-modal.tsx` | Modify | Support pre-selection from quick-repeat |
| `game-log.tsx` | Modify | Increase icon sizes from 12px to 20px |
| `quick-repeat-button.tsx` | NEW | Dedicated quick-action component |
| `mutation-feedback.tsx` | NEW | Loading/success/error indicator |

### Tailwind Class Changes

| Element | Current | Target |
|---------|---------|--------|
| Period display | `text-[10px]` (portrait), `text-[8px]` (landscape) | `text-sm` (portrait), `text-xs` (landscape) |
| Game log icons | `size={12}` | `size={20}` |
| Connection indicator | `w-2 h-2` (portrait), `w-1.5 h-1.5` (landscape) | `w-3 h-3` (portrait), `w-2 h-2` (landscape) |
| Miss buttons | `opacity-60` | `opacity-80` |
| Foul buttons | `p-4` | `p-6` |

### Touch Target Standards

```typescript
// New constants for consistent sizing
const TOUCH_TARGETS = {
  primary: 'min-h-[48px] min-w-[48px]', // WCAG 2.5.5 minimum
  secondary: 'min-h-[44px] min-w-[44px]', // Secondary actions
  icon: 'min-h-[32px] min-w-[32px] p-2', // Icon-only buttons
} as const;

const FONT_SIZES = {
  periodPortrait: 'text-sm', // 14pt
  periodLandscape: 'text-xs', // 12pt
  clockPortrait: 'text-4xl', // 36pt
  clockLandscape: 'text-3xl', // 28pt
} as const;
```

## Quickstart

```bash
# 1. Start development server
npm run dev

# 2. Open scorer page
open http://localhost:3000/game/{game-id}/scorer

# 3. Test touch targets
# - Open DevTools > Toggle device toolbar
# - Test iPhone SE (375px), iPhone 14 Pro (393px), iPad Pro (1024px)
# - Verify all buttons are tappable without precision

# 4. Test quick-repeat feature
# - Score for a player
# - Verify "Score Again" button appears
# - Tap button, verify modal opens with player pre-selected

# 5. Test mutation feedback
# - Score rapidly
# - Verify visual feedback on button during sync
# - Simulate network delay to see loading state

# 6. Run tests
npm run test -- --grep "scorer-ux"
```

## Implementation Priority

1. **P1: Touch Target Fixes** (Low complexity, high impact)
   - Increase period/clock text sizes
   - Increase game log icon sizes
   - Increase foul button padding
   - Increase connection indicator size

2. **P1: Quick-Repeat Shortcut** (Medium complexity, high impact)
   - Add lastScorer state in page.tsx
   - Create QuickRepeatButton component
   - Modify scoring modal for pre-selection
   - Clear state on lineup changes

3. **P2: MutationFeedback** (Medium complexity, medium impact)
   - Track in-flight mutations
   - Add loading state to buttons
   - Add success/error toasts

4. **P2: Landscape Optimization** (Low complexity, medium impact)
   - Add tablet breakpoint detection
   - Collapse box-score button on narrow
   - Increase miss button opacity

5. **P3: Debounce Implementation** (Low complexity, low impact)
   - Add debounce to scoring buttons
   - Prevent rapid-tap duplicate mutations

## Testing Strategy

### Unit Tests
- `quick-repeat-button.test.tsx`: Test visibility logic, state clearing
- `mutation-feedback.test.tsx`: Test loading/success/error states
- Touch target constants: Verify minimum sizes

### E2E Tests
- `scorer-ux.spec.ts`: Test touch targets on mobile/tablet viewports
- Quick-repeat flow: Score → see button → tap → verify pre-selection
- Mutation feedback: Rapid tap → verify single mutation

### Accessibility Tests
- WCAG 2.5.5 compliance: All interactive elements ≥ 44×44pt
- Color contrast: Verify miss button opacity (70%)
- Screen reader: Verify announcements for quick-repeat