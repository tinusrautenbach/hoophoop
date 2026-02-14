# Minutes Tracking Test Coverage Analysis

## Current Test Suite Summary
**Total Tests: 24** (all passing)

### ✅ Covered Test Scenarios

#### 1. Basic Substitution Tracking (4 tests)
- ✓ Single substitution in/out
- ✓ Multiple players with substitutions
- ✓ Player who never subs out (plays full period)
- ✓ Player who never subs in (bench player)

#### 2. Period Transitions (3 tests)
- ✓ Minutes across period boundaries
- ✓ Subbing in during second period
- ✓ Multiple period starts with active roster

#### 3. Complex Substitution Patterns (2 tests)
- ✓ Multiple ins and outs in same period
- ✓ 5-player rotation scenario

#### 4. Edge Cases (8 tests)
- ✓ Empty events array
- ✓ Empty roster
- ✓ Events for non-roster players
- ✓ Sub out without prior sub in
- ✓ Sub in when already on court
- ✓ Sub out when not on court
- ✓ Very short substitution (< 1 minute)
- ✓ Clock value handling (full period)
- ✓ Partial period (game in progress)

#### 5. Validation (4 tests)
- ✓ Reasonable minutes validation
- ✓ Excessive minutes detection
- ✓ Negative minutes detection
- ✓ Multi-period validation

#### 6. Integration Scenarios (2 tests)
- ✓ Realistic game scenario
- ✓ 5-player court constraint

---

## ❌ Missing Test Coverage

### Critical Gaps

#### 1. **Implementation Differences** (HIGH PRIORITY)
**Issue**: The box-score page has a different implementation than the test utility

**Box-score/page.tsx line 286-287**:
```typescript
const timeOnCourt = periodLength - event.clockAt;
```

**Utility function** (correct):
```typescript
const timeOnCourt = startTime.clockAt - event.clockAt;
```

The box-score page is using `periodLength` instead of `startTime.clockAt` when calculating time on court at period end. This is a **BUG** that would give incorrect minutes for players who subbed in mid-period.

**Missing Tests**:
- [ ] Test that verifies box-score page implementation matches utility
- [ ] Integration test with actual box-score page logic
- [ ] Test for player who subs in mid-period and plays until period end

#### 2. **Period Length Variations** (MEDIUM PRIORITY)
**Missing Tests**:
- [ ] Different period lengths (8 minutes, 12 minutes, 20 minutes)
- [ ] NBA quarters (12 minutes = 720 seconds)
- [ ] FIBA quarters (10 minutes = 600 seconds)
- [ ] College halves (20 minutes = 1200 seconds)

#### 3. **Overtime Periods** (MEDIUM PRIORITY)
**Missing Tests**:
- [ ] Period 5 (first overtime)
- [ ] Multiple overtime periods (periods 5, 6, 7+)
- [ ] Different overtime lengths (5 minutes vs 4 minutes)

#### 4. **Event Type Edge Cases** (MEDIUM PRIORITY)
**Missing Tests**:
- [ ] Clock start/stop events (timeout handling)
- [ ] Undo events (reversal of substitution)
- [ ] Events without descriptions
- [ ] Events with malformed descriptions (missing "In" or "Benched")
- [ ] Events with player names but no actual player field

#### 5. **Concurrent Player States** (MEDIUM PRIORITY)
**Missing Tests**:
- [ ] More than 5 players active simultaneously (data error detection)
- [ ] All roster players active (full team rotation)
- [ ] Rapid substitutions (< 10 seconds on court)

#### 6. **Data Quality & Validation** (LOW PRIORITY)
**Missing Tests**:
- [ ] Duplicate event IDs
- [ ] Events with clockAt > periodLength
- [ ] Events with negative clockAt
- [ ] Events with period = 0 or negative period
- [ ] Events out of chronological order

#### 7. **Integration with Box-Score Page** (HIGH PRIORITY)
**Missing Tests**:
- [ ] Test that minutes column displays correctly
- [ ] Test that minutes update on game events
- [ ] Test export to HTML includes minutes
- [ ] Test minutes calculation with real game data

#### 8. **Real-World Scenarios** (MEDIUM PRIORITY)
**Missing Tests**:
- [ ] Game with no substitutions (starters play whole game)
- [ ] Game with constant substitutions (every 30 seconds)
- [ ] Game with injured player (sudden sub out, no sub in)
- [ ] Game with technical fouls affecting clock
- [ ] Game that goes to overtime unexpectedly

#### 9. **Performance** (LOW PRIORITY)
**Missing Tests**:
- [ ] Large number of events (> 1000 events)
- [ ] Large roster (> 15 players)
- [ ] Many periods (> 6 periods including OT)

#### 10. **Time Calculations** (MEDIUM PRIORITY)
**Missing Tests**:
- [ ] Exact minute boundaries (exactly 5.0 minutes)
- [ ] Rounding edge cases (2.95 -> 3.0, 2.94 -> 2.9)
- [ ] Sub-millisecond precision handling

---

## Implementation Issues Found

### Bug #1: Box-Score Page Period End Calculation
**Location**: `/src/app/game/[id]/box-score/page.tsx:286-287`

**Current Code**:
```typescript
} else if (event.type === 'period_end') {
    Object.keys(playerOnCourt).forEach(name => {
        if (playerOnCourt[name]) {
            const timeOnCourt = periodLength - event.clockAt;  // ❌ BUG
            playerStats[name].minutes += timeOnCourt / 60;
```

**Problem**: Uses `periodLength` instead of when the player actually started playing

**Impact**: Players who subbed in mid-period get credited for full period minutes

**Example**:
- Player subs in at 5:00 (clock = 300)
- Period ends at 0:00 (clock = 0)
- Actual minutes: 5.0
- Calculated minutes: 10.0 (WRONG!)

**Fix**:
```typescript
const startTime = playerOnCourt[name]!;
const timeOnCourt = startTime.clockAt - event.clockAt;  // ✓ CORRECT
```

### Bug #2: Unused Variable
**Location**: `/src/app/game/[id]/box-score/page.tsx:271`

**Issue**: `lastPeriodEndClock` is set but never used

### Bug #3: Game End Logic
**Location**: `/src/app/game/[id]/box-score/page.tsx:314-320`

**Issue**: Uses last event's clockAt regardless of which period it's in

**Current Code**:
```typescript
const lastClock = sortedEvents.length > 0 ? sortedEvents[sortedEvents.length - 1].clockAt : periodLength;
```

**Problem**: If last event is from period 1, but we're in period 2, calculation is wrong

**Fix**: Filter to current period only (as done in utility function)

---

## Recommended Test Additions

### High Priority Tests (Fix Bugs)

```typescript
// Test 1: Player subs in mid-period, plays until period end
it('should correctly calculate minutes for mid-period sub', () => {
    const roster = createRoster([
        { name: 'Player 1', number: '1', isActive: false }
    ]);

    const events: GameEvent[] = [
        createEvent('period_start', 1, 600, undefined, 'Period 1 Start'),
        createEvent('sub', 1, 300, 'Player 1', 'Player 1 In'),  // Sub in at 5:00
        createEvent('period_end', 1, 0, undefined, 'Period 1 End'),  // Period ends
    ];

    const minutes = calculatePlayerMinutes(events, roster, 600, 1);
    
    // Should be exactly 5.0 minutes, not 10.0
    expect(minutes['Player 1']).toBe(5.0);
});

// Test 2: Different period lengths
it('should handle 12-minute NBA quarters', () => {
    const roster = createRoster([
        { name: 'Player 1', number: '1', isActive: true }
    ]);

    const events: GameEvent[] = [
        createEvent('period_start', 1, 720, undefined, 'Period 1 Start'),
        createEvent('sub', 1, 360, 'Player 1', 'Player 1 Benched'),
        createEvent('period_end', 1, 0, undefined, 'Period 1 End'),
    ];

    const minutes = calculatePlayerMinutes(events, roster, 720, 1);
    
    expect(minutes['Player 1']).toBe(6.0);  // 6 minutes, not 5
});

// Test 3: Overtime period
it('should handle overtime periods', () => {
    const roster = createRoster([
        { name: 'Player 1', number: '1', isActive: true }
    ]);

    const events: GameEvent[] = [
        createEvent('period_start', 5, 300, undefined, 'OT Start'),  // 5-min OT
        createEvent('sub', 5, 150, 'Player 1', 'Player 1 Benched'),
        createEvent('period_end', 5, 0, undefined, 'OT End'),
    ];

    const minutes = calculatePlayerMinutes(events, roster, 300, 5);
    
    expect(minutes['Player 1']).toBe(2.5);
});
```

### Medium Priority Tests

```typescript
// Test 4: Event without description
it('should handle sub event without description', () => {
    const roster = createRoster([
        { name: 'Player 1', number: '1', isActive: true }
    ]);

    const events: GameEvent[] = [
        createEvent('sub', 1, 600, 'Player 1', ''),  // Empty description
    ];

    const minutes = calculatePlayerMinutes(events, roster, 600, 1);
    
    // Should not crash, but may not track minutes correctly
    expect(minutes['Player 1']).toBeGreaterThanOrEqual(0);
});

// Test 5: Rapid substitutions
it('should handle rapid substitutions', () => {
    const roster = createRoster([
        { name: 'Player 1', number: '1', isActive: true }
    ]);

    const events: GameEvent[] = [
        createEvent('sub', 1, 600, 'Player 1', 'Player 1 In'),
        createEvent('sub', 1, 595, 'Player 1', 'Player 1 Benched'),  // 5 seconds
        createEvent('sub', 1, 590, 'Player 1', 'Player 1 In'),       // 5 seconds later
        createEvent('sub', 1, 585, 'Player 1', 'Player 1 Benched'),  // 5 seconds
    ];

    const minutes = calculatePlayerMinutes(events, roster, 600, 1);
    
    // Should be approximately 0.17 minutes (10 seconds)
    expect(minutes['Player 1']).toBeCloseTo(0.2, 1);
});

// Test 6: Game with no substitutions
it('should handle game with no substitutions', () => {
    const roster = createRoster([
        { name: 'Starter 1', number: '1', isActive: true },
        { name: 'Starter 2', number: '2', isActive: true },
        { name: 'Starter 3', number: '3', isActive: true },
        { name: 'Starter 4', number: '4', isActive: true },
        { name: 'Starter 5', number: '5', isActive: true },
    ]);

    const events: GameEvent[] = [
        createEvent('period_start', 1, 600, undefined, 'Period 1 Start'),
        createEvent('period_end', 1, 0, undefined, 'Period 1 End'),
    ];

    const minutes = calculatePlayerMinutes(events, roster, 600, 1);
    
    // All starters should have 10 minutes
    expect(minutes['Starter 1']).toBe(10.0);
    expect(minutes['Starter 2']).toBe(10.0);
    // ... etc
});
```

---

## Action Items

### Immediate (This Sprint)
1. **Fix Bug #1** in box-score/page.tsx - change periodLength to startTime.clockAt
2. **Fix Bug #3** in box-score/page.tsx - filter lastClock to current period only
3. **Remove unused variable** lastPeriodEndClock
4. **Add Test 1** (mid-period sub) to prevent regression

### Short Term (Next Sprint)
5. Add tests for different period lengths
6. Add tests for overtime periods
7. Add integration tests with actual box-score page
8. Add tests for edge cases (empty descriptions, rapid subs)

### Long Term (Backlog)
9. Add performance tests
10. Add real-world scenario tests
11. Add data quality validation tests
12. Create visual regression tests for minutes display

---

## Test Coverage Metrics

| Category | Tests | Coverage |
|----------|-------|----------|
| Basic Functionality | 11 | ✅ Good |
| Edge Cases | 8 | ✅ Good |
| Period Handling | 3 | ⚠️  Needs more |
| Validation | 4 | ✅ Good |
| Integration | 2 | ❌ Needs work |
| Real-World Scenarios | 0 | ❌ Missing |
| **TOTAL** | **24** | **⚠️  Partial** |

**Recommendation**: Add 8-10 more tests focusing on:
- Period length variations
- Overtime handling  
- Real-world scenarios
- Box-score integration
