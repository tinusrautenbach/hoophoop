# Minutes Tracking Test Suite

This comprehensive test suite validates the accuracy of player minutes tracking in basketball games.

## Overview

The minutes tracking system calculates how long each player spends on the court based on substitution events, period starts, and period ends.

## Test Coverage

### 1. Basic Substitution Tracking (5 tests)
- **Single substitution in/out**: Validates basic time calculation for a player who subs in and out
- **Multiple players**: Ensures simultaneous tracking of multiple players
- **Never subs out**: Tests players who start but don't get subbed out
- **Never subs in**: Verifies bench players show 0 minutes
- **Basic flow**: Core substitution tracking functionality

### 2. Period Transitions (4 tests)
- **Across period boundaries**: Validates time accumulation across multiple periods
- **Subbing in during second period**: Tests mid-game substitutions
- **Multiple period starts**: Ensures period_start events correctly activate roster players
- **Period transitions**: Validates time calculation when periods end

### 3. Complex Substitution Patterns (2 tests)
- **Multiple ins/outs**: Tests players with multiple substitutions in a single period
- **5-player rotation**: Validates realistic team rotation scenarios

### 4. Edge Cases (9 tests)
- **Empty events**: Handles games with no events
- **Empty roster**: Validates empty roster handling
- **Non-roster players**: Ensures only roster players are tracked
- **Sub out without sub in**: Handles edge case of benching without entering
- **Sub in when already on court**: Prevents double counting
- **Sub out when not on court**: Handles invalid state gracefully
- **Very short substitutions**: Tests sub-minute playing times
- **Clock value handling**: Validates various clock positions
- **Partial period**: Handles games in progress

### 5. Validation (4 tests)
- **Reasonable minutes**: Validates realistic minute totals
- **Excessive minutes**: Detects impossible minute totals
- **Negative minutes**: Ensures no negative values
- **Multi-period validation**: Validates across multiple periods

### 6. Integration Scenarios (2 tests)
- **Realistic game scenario**: Full game simulation
- **5-player constraint**: Validates total minutes align with 5-player limit

## Running the Tests

```bash
# Run all minutes tracking tests
npm test -- src/utils/__tests__/minutesTracking.test.ts

# Run with coverage
npm test -- src/utils/__tests__/minutesTracking.test.ts --coverage

# Run in watch mode
npm test -- src/utils/__tests__/minutesTracking.test.ts --watch
```

## Key Implementation Details

### Clock Values
- Clock values are in **seconds**
- Clock at 600 = 10:00 (start of period)
- Clock at 0 = 0:00 (end of period)
- Counts down from period length to 0

### Event Types
- `sub` (with " In" description): Player entering court
- `sub` (with " Benched" description): Player leaving court
- `period_start`: All active roster players start playing
- `period_end`: All players stop playing

### Calculation Logic
1. **Sort events** by period (ascending) then clock (descending)
2. **Track player state** (on court vs. off court)
3. **Calculate time** when player leaves court or period ends
4. **Round to 1 decimal place** for display

### Important Notes
- Player must be in roster to track minutes
- Only `sub` events require a player name
- `period_start` and `period_end` apply to all roster players
- Players still on court at game end are calculated to last event or period end

## Integration with Box Score Page

To integrate this utility with the box-score page:

```typescript
import { calculatePlayerMinutes, validateMinutes } from '@/utils/minutesTracking';

// In calculateTeamStats function:
const roster = game.rosters?.filter(r => r.team === team) || [];
const events = (game.events || []).filter(e => e.team === team);

// Calculate minutes for each player
const playerMinutes = calculatePlayerMinutes(events, roster, 600, game.currentPeriod);

// Validate the calculation
const validation = validateMinutes(playerMinutes, 600, game.currentPeriod);
if (!validation.isValid) {
    console.warn('Minutes validation failed:', validation.errors);
}

// Merge with other player stats
Object.keys(playerStats).forEach(name => {
    playerStats[name].minutes = playerMinutes[name] || 0;
});
```

## Expected Behavior Examples

### Example 1: Simple Substitution
```
Period 1, Clock 600: Player A subs in
Period 1, Clock 300: Player A subs out
Result: Player A = 5.0 minutes
```

### Example 2: Full Period
```
Period 1, Clock 600: Player B subs in
Period 1, Clock 0: Period ends
Result: Player B = 10.0 minutes
```

### Example 3: Multi-Period
```
Period 1: Player C plays full period (10 min)
Period 2: Player C plays 5 minutes then subs out
Result: Player C = 15.0 minutes
```

### Example 4: Multiple Substitutions
```
Period 1, Clock 600: Player D subs in
Period 1, Clock 400: Player D subs out (3.33 min)
Period 1, Clock 300: Player D subs in
Period 1, Clock 100: Player D subs out (3.33 min)
Result: Player D = 6.7 minutes
```

## Troubleshooting

### Issue: Player shows 0 minutes when they should have played
**Check**: Ensure the player is in the roster with `isActive: true` and there are `sub` events with the correct player name.

### Issue: Minutes exceed period length
**Check**: Validate that `period_end` events are being processed correctly and players aren't double-counted.

### Issue: Negative minutes
**Check**: Ensure events are sorted correctly (clock descending within each period).

## Future Enhancements

- [ ] Support for overtime periods
- [ ] Timeouts that stop the clock
- [ ] Exact second-level precision
- [ ] Real-time minutes updates during live games
- [ ] Export minutes data for analysis
