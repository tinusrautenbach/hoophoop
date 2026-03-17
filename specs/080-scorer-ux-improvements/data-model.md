# Data Model: Scorer Page UX Improvements

**Feature**: 080-scorer-ux-improvements  
**Date**: 2026-03-17

## Overview

This feature is primarily UI/UX focused with minimal new data entities. The changes involve React state management for quick-repeat functionality and mutation feedback, but no new database schemas or API endpoints.

## New UI State Entities

### LastScorerState

Tracks the most recent scorer for quick-repeat functionality.

```typescript
interface LastScorerState {
  playerId: string | null;
  playerName: string | null;
  team: 'home' | 'guest' | null;
  points: 1 | 2 | 3 | null;
  timestamp: number; // When last scored (for expiration)
}
```

**Lifecycle**:
- Created when player scores successfully
- Cleared on: substitution, timeout, period end, team change
- Not persisted (session-only, lost on page refresh)

**Location**: `src/app/game/[id]/scorer/page.tsx` as React state

### MutationFeedbackState

Tracks in-flight mutations for visual feedback.

```typescript
interface PendingMutation {
  id: string;           // Unique mutation identifier
  type: 'score' | 'foul' | 'timeout' | 'sub';
  target: string;      // UI element identifier
  startedAt: number;
}

interface MutationFeedbackState {
  pending: Set<string>; // Active mutation IDs
  lastSuccess: { type: string; timestamp: number } | null;
  lastError: { type: string; message: string } | null;
}
```

**Lifecycle**:
- Created when mutation starts
- Updated on success/error
- Cleared after timeout (5s for success, 10s for error)

**Location**: `src/app/game/[id]/scorer/page.tsx` as React state

## Modified Existing Entities

### ScoringModalProps

Extended to support pre-selection.

```typescript
// Before
interface ScoringModalProps {
  game: Game;
  scoringFor: { points: number; side?: 'home' | 'guest'; isMiss?: boolean };
  onClose: () => void;
  onScore: (playerId: string | null, team: 'home' | 'guest') => void;
}

// After
interface ScoringModalProps {
  game: Game;
  scoringFor: { 
    points: number; 
    side?: 'home' | 'guest'; 
    isMiss?: boolean;
    preSelectedPlayerId?: string; // NEW
  };
  onClose: () => void;
  onScore: (playerId: string | null, team: 'home' | 'guest') => void;
}
```

## Touch Target Constants

No database entities, but new shared constants for consistent sizing.

```typescript
// src/lib/constants/touch-targets.ts

export const TOUCH_TARGETS = {
  // WCAG 2.5.5 Level AAA minimum
  primary: 'min-h-[48px] min-w-[48px]',
  // Secondary actions (slightly smaller acceptable)
  secondary: 'min-h-[44px] min-w-[44px]',
  // Icon-only buttons (with padding)
  icon: 'min-h-[32px] min-w-[32px] p-2',
} as const;

export const VISUAL_SIZES = {
  // Text sizes for period/clock displays
  periodPortrait: 'text-sm',     // 14pt
  periodLandscape: 'text-xs',    // 12pt
  clockPortrait: 'text-4xl',     // 36pt
  clockLandscape: 'text-3xl',   // 28pt
  // Icon sizes
  gameLogIcon: 20,              // Up from 12
  connectionIndicator: 'w-3 h-3', // Up from w-2 h-2
} as const;

export const ANIMATION_DURATIONS = {
  mutationFeedback: 100, // ms - visible feedback delay
  debounceWindow: 300,   // ms - minimum time between same actions
} as const;
```

## Data Flow

### Quick-Repeat Flow

```
User taps +2
    ↓
ScoringModal opens
    ↓
User selects Player A
    ↓
Score recorded
    ↓
Modal closes
    ↓
lastScorerState = { playerId: A, points: 2, timestamp: now }
    ↓
QuickRepeatButton appears (portrait/landscape)
    ↓
User taps QuickRepeatButton
    ↓
ScoringModal opens with preSelectedPlayerId: A
    ↓
User taps +2 (one tap, same player)
    ↓
Score recorded
```

### Mutation Feedback Flow

```
User taps button
    ↓
setPendingMutations(prev => prev.add(mutationId))
    ↓
Button shows subtle pulse animation
    ↓
Mutation completes (success)
    ↓
setPendingMutations(prev => prev.delete(mutationId))
setLastSuccess({ type: 'score', timestamp: now })
    ↓
Button shows brief success color (green flash)
    ↓
After 5s, clear lastSuccess
```

## No Database Changes

This feature requires:
- No new tables
- No new columns
- No migrations
- No API endpoint changes

All changes are in React state and CSS classes.