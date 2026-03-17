# Research: Scorer Page UX Improvements

**Feature**: 080-scorer-ux-improvements  
**Date**: 2026-03-17

## Research Questions

### 1. Current Touch Target Sizing Strategy

**Finding**: Touch targets are defined using Tailwind utility classes with inconsistent sizing across components.

**Current Sizes**:

| Element | Portrait | Landscape | Issue |
|---------|----------|-----------|-------|
| Score buttons | `p-6` (~100px) | Varied | Good |
| Miss buttons | `p-4` (~80px) | `opacity-60` | Marginal, low visibility |
| Foul buttons | `p-4` (~64px) | Same | Marginal (44pt min) |
| Period display | `text-[10px]` | `text-[8px]` | Too small |
| Clock | `text-4xl` | `text-3xl` | Good |
| Connection indicator | `w-2 h-2` | `w-1.5 h-1.5` | Too small |
| Game log icons | `size={12}` | Same | Too small |
| Timer button | `h-20` | Full height | Good |

**Recommendation**: Create consistent touch target constants using Tailwind's theme extension or inline utility classes. Focus on:
- Increase `text-[10px]` and `text-[8px]` to `text-sm` and `text-xs`
- Increase `size={12}` icons to `size={20}`
- Increase `p-4` buttons to `p-6`

### 2. Scoring Modal Player Selection Flow

**Finding**: The `ScoringModal` component has a clear state flow that can be extended for pre-selection.

**Current Flow**:
```typescript
// scoring-modal.tsx
const [selectedTeam, setSelectedTeam] = useState<'home' | 'guest' | null>(scoringFor.side || null);

// When scoringFor.side is provided, team is pre-selected
// But player selection still requires explicit click
```

**Recommendation**: Extend `scoringFor` prop to include optional `playerId`:
```typescript
interface ScoringModalProps {
  scoringFor: { points: number; isMiss?: boolean; side?: 'home' | 'guest'; playerId?: string };
  // ...
}
```

When `playerId` is provided, the modal should:
1. Pre-select that player
2. Highlight the selection
3. Allow one-click confirmation or re-selection

### 3. Mutation Feedback Implementation

**Finding**: No explicit mutation feedback exists. The `useHasuraGame` hook uses CAS (compare-and-swap) with versioned updates but provides no visual feedback during mutations.

**Current State**:
- Scores update via `updateScore()` which calls `versionedUpdate()`
- No loading state on buttons during mutation
- WebSocket subscription pushes updates after server confirmation
- Conflict detection shows a banner but only after failure

**Recommendation**: Add mutation state tracking:
```typescript
// New state in page.tsx
const [pendingMutations, setPendingMutations] = useState<Set<string>>(new Set());

// Track mutation lifecycle
const handleScoreWithFeedback = async (points: number, side?: 'home' | 'guest') => {
  const mutationId = `score-${Date.now()}`;
  setPendingMutations(prev => new Set(prev).add(mutationId));
  
  try {
    await updateScore('home', points);
    // Visual success feedback
  } finally {
    setPendingMutations(prev => {
      const next = new Set(prev);
      next.delete(mutationId);
      return next;
    });
  }
};
```

### 4. Responsive Breakpoints

**Finding**: The scorer page uses a custom `landscape:` Tailwind variant rather than standard `sm:/md:/lg:` breakpoints.

**Current Strategy**:
```tsx
// Portrait layout (default)
<div className="flex flex-col flex-1 landscape:hidden">

// Landscape layout (CSS media query)
<div className="hidden landscape:grid grid-cols-[1fr_1.5fr_1fr]">
```

**Impact**: 
- No distinction between mobile landscape and tablet landscape
- Elements don't scale based on actual width, only orientation
- Tablet users get same cramped layout as mobile landscape

**Recommendation**: Add device-width breakpoints:
```tsx
// Mobile landscape
<div className="hidden landscape:grid landscape:md:hidden">

// Tablet and desktop landscape
<div className="hidden landscape:md:grid">
```

### 5. Debounce Strategy

**Finding**: No debounce exists on scoring buttons. Each click fires an immediate mutation.

**Current Behavior**:
- Rapid taps send multiple mutations
- CAS will reject duplicates but still processes them
- No client-side rate limiting

**Recommendation**: Add debounce with leading edge:
```typescript
import { useCallback, useRef } from 'react';

const useDebouncedScore = () => {
  const lastScoreTime = useRef(0);
  
  const handleScore = useCallback((points: number, side?: 'home' | 'guest') => {
    const now = Date.now();
    if (now - lastScoreTime.current < 300) {
      // Debounce: ignore clicks within 300ms
      return;
    }
    lastScoreTime.current = now;
    // Original score logic
  }, []);
  
  return handleScore;
};
```

**Alternative**: Use Framer Motion's `tap` event which has built-in debouncing.

## Technology Decisions

### Touch Target Implementation

**Decision**: Use Tailwind inline classes for touch targets
**Rationale**: 
- Consistent with existing CSS strategy
- No new build dependencies
- Easy to adjust per-component
- Can extract to theme later if needed

**Alternatives Considered**:
- CSS custom properties (more setup, same outcome)
- New stylesheet (unnecessary complexity)

### Quick-Repeat Button State

**Decision**: React state in `page.tsx` with explicit clear triggers
**Rationale**:
- Simple, no Zustand store needed
- State lives near where it's used
- Easy to clear on substitutions/timeouts

**Alternatives Considered**:
- Zustand store (overkill for single feature)
- URL state (not needed for transient UI state)

### Mutation Feedback

**Decision**: Local state tracking with `Set<string>` for pending mutations
**Rationale**:
- Lightweight, no additional infrastructure
- Already have React state management in page
- Can be extracted to hook if needed

**Alternatives Considered**:
- React Query mutations (adds dependency)
- Zustand loading store (overkill)

### Responsive Strategy

**Decision**: Keep `landscape:` variant, add `md:` breakpoint for tablets
**Rationale**:
- Maintains backward compatibility
- Adds tablet-specific improvements
- Minimal code changes

## Best Practices Identified

1. **WCAG 2.5.5 Touch Target**: All interactive elements ≥ 44×44pt (WCAG Level AAA)
2. **Mutation Feedback**: Visual confirmation within 100ms of user action
3. **Debounce Pattern**: 300ms minimum between same-action triggers
4. **Accessibility**: `type="button"` for all `<button>` elements (prevents form submission)
5. **Framer Motion**: Use `animate` with `transition: { duration: 0.1 }` for quick feedback