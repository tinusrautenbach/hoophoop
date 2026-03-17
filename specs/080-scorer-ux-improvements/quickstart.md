# Quickstart: Scorer Page UX Improvements

**Feature**: 080-scorer-ux-improvements  
**Date**: 2026-03-17

## Prerequisites

- Node.js 18+ (check with `node --version`)
- npm 9+ (check with `npm --version`)
- Access to a running development server or test game

## Quick Setup

```bash
# Clone and install (if needed)
git checkout 080-scorer-ux-improvements
npm install

# Start development server
npm run dev

# Open scorer page (use an existing game ID or create new)
open http://localhost:3000/game/{game-id}/scorer
```

## Testing Touch Targets

### Manual Testing

1. **Open DevTools** → Toggle device toolbar (Cmd+Shift+M)
2. **Test viewports**:
   - iPhone SE (375×667) - Smallest mobile portrait
   - iPhone 14 Pro (393×852) - Common mobile portrait
   - iPhone 14 Pro Landscape (852×393) - Mobile landscape
   - iPad Pro (1024×768) - Tablet landscape
3. **Verify each element**:
   - Period display: Readable at arm's length
   - Score buttons: Easy to tap without precision
   - Foul buttons: Tapable with thumb
   - Game log icons: Visible and tapable
   - Connection indicator: Visible from distance

### Automated Testing

```bash
# Run touch target tests
npm run test -- --grep "touch-target"

# Run E2E tests on mobile viewports
npm run test:e2e -- scorer-ux.spec.ts
```

## Testing Quick-Repeat Feature

### Setup

1. Create or join a game
2. Set roster with at least one player per team
3. Start the game (status: live)

### Test Flow

```
1. Tap +2 or +3 button
2. Select a player (e.g., Player #23)
3. Verify modal closes after scoring
4. Look for "Score Again" button in the UI
5. Tap "Score Again" button
6. Verify modal opens with Player #23 pre-selected
7. Tap +2 to complete the repeat score
8. Verify only 2 taps needed (vs 3 for first score)
```

### Clear Conditions

Test that the quick-repeat button disappears when:
- A substitution is made (Subs modal used)
- A timeout is called
- The period changes
- A different player scores

## Testing Mutation Feedback

### Setup

1. Open DevTools → Network tab
2. Enable "Slow 3G" throttling

### Test Flow

```
1. Tap +2 button
2. Watch for subtle pulse animation on button
3. Verify score completes
4. Look for brief success highlight (green flash)
```

### Error Scenario

```
1. Disable network in DevTools
2. Tap +2 button
3. Verify error toast appears after timeout
4. Verify button returns to normal state
```

## Testing Landscape Optimization

### Narrow Device (< 600pt)

1. Set viewport to 568×320 (iPhone SE landscape)
2. Verify Box Score button collapses or hides
3. Verify scoring buttons remain tappable
4. Verify miss buttons have ≥ 70% opacity

### Tablet (≥ 600pt)

1. Set viewport to 1024×768 (iPad Pro)
2. Verify all buttons have ≥ 60×60pt touch targets
3. Verify game log shows ≥ 8 items
4. Verify text sizes are readable

## Verification Checklist

After implementation, verify:

- [ ] Period display ≥ 12pt in landscape, ≥ 14pt in portrait
- [ ] Clock display ≥ 28pt in landscape, ≥ 36pt in portrait
- [ ] All score buttons ≥ 60×60pt touch target
- [ ] Foul buttons ≥ 48×48pt touch target
- [ ] Game log icons ≥ 20px visual size, ≥ 32×32pt touch target
- [ ] Connection indicator ≥ 6×6pt
- [ ] Miss buttons ≥ 70% opacity in landscape
- [ ] Quick-repeat button appears after player scores
- [ ] Quick-repeat button clears on substitutions/timeouts
- [ ] Mutation feedback shows within 100ms
- [ ] No double-scoring on rapid taps (debounce works)

## Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Quick-repeat not appearing | State not being set | Check `lastScorer` state in page.tsx |
| Touch targets still small | Tailwind classes not applied | Verify `min-h-[48px]` classes |
| No mutation feedback | Missing pending state | Check `pendingMutations` Set in React state |
| Landscape layout broken | Breakpoint conflict | Verify `landscape:` and `md:` combinations |

## Files Modified

```
src/app/game/[id]/scorer/page.tsx
src/components/scorer/simple-scorer.tsx
src/components/scorer/advanced-scorer.tsx
src/components/scorer/scoring-modal.tsx
src/components/scorer/game-log.tsx
src/lib/constants/touch-targets.ts (new)
src/components/scorer/quick-repeat-button.tsx (new)
src/components/scorer/mutation-feedback.tsx (new)
tests/components/scorer/quick-repeat-button.test.tsx (new)
tests/components/scorer/mutation-feedback.test.tsx (new)
tests/e2e/scorer-ux.spec.ts (new)
```