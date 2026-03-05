# Quickstart: Configurable Player Statistics

**Feature**: 078-configurable-player-stats  
**Date**: 2026-03-05

---

## Overview

This quickstart guide demonstrates how to:
1. Configure which stats to track for a game
2. Set up multi-scorer stat focus
3. Record different stats from multiple scorers
4. View aggregated box score

---

## Prerequisites

- Existing game created
- At least 2 users with scorer access to the game
- Both scorers logged in on separate devices/tabs

---

## Scenario 1: Configure Game Stats

### Step 1: Game Creator Sets Up Stats

1. **Navigate to game settings**
   - Open game page
   - Click "Settings" or "Configure"

2. **Configure tracked statistics**
   ```
   Statistics Configuration
   
   [✓] Points (1PT)      [✓] Points (2PT)      [✓] Points (3PT)
   [✓] Offensive Rebound [✓] Defensive Rebound [✗] Assist
   [✗] Steal             [✗] Block             [✗] Turnover
   [✗] Personal Foul
   
   [Save Configuration]
   ```

3. **Expected Result**
   - Configuration saved
   - Only selected stats will be available during scoring

---

## Scenario 2: Multi-Scorer Setup

### Step 2: Scorer A Sets Focus

1. **Scorer A joins game**
   - Open scoring interface
   - See stat focus selector: "My Stats: [Select Focus ▼]"

2. **Select primary focus**
   ```
   Choose Your Focus (1-3 stats):
   
   Primary:
   [✓] Points (2PT)
   [✓] Points (3PT)
   [✗] Offensive Rebound
   
   [Set Focus]
   ```

3. **Expected Result**
   - Large quick-access buttons appear for Points (2PT) and Points (3PT)
   - "More Stats" button shows other enabled stats

### Step 3: Scorer B Sets Different Focus

1. **Scorer B joins same game**
   - On separate device/tab

2. **Select different focus**
   ```
   Choose Your Focus:
   
   Primary:
   [✓] Offensive Rebound
   [✓] Defensive Rebound
   [✗] Points (2PT)
   
   [Set Focus]
   ```

3. **Expected Result**
   - Scorer B sees quick-access buttons for Rebounds
   - Scorer B can see Scorer A's focus in "Other Scorers" panel

---

## Scenario 3: Recording Stats Simultaneously

### Step 4: Both Scorers Record Events

**Timeline:**

```
T+0s    Scorer A taps: Player 23 → 2PT Points
        → Event appears in game log
        → Player 23 score: 2 pts

T+2s    Scorer B taps: Player 15 → Offensive Rebound
        → Event appears in game log
        → Player 15 stats: 1 reb

T+5s    Scorer A taps: Player 23 → 3PT Points
        → Event appears in game log
        → Player 23 score: 5 pts (2+3)

T+8s    Scorer B taps: Player 15 → Defensive Rebound
        → Event appears in game log
        → Player 15 stats: 2 reb (1 off, 1 def)
```

### Expected Result

**Game Log (both scorers see same):**
```
[10:05:23] Player 23 - 2PT Points (Scorer A)
[10:05:25] Player 15 - Offensive Rebound (Scorer B)
[10:05:28] Player 23 - 3PT Points (Scorer A)
[10:05:31] Player 15 - Defensive Rebound (Scorer B)
```

**Box Score (both scorers see same):**
```
Home Team
Player 23: 5 PTS (2 2PT, 1 3PT)
Player 15: 2 REB (1 OFF, 1 DEF)
```

---

## Scenario 4: Recording Secondary Stats

### Step 5: Scorer A Records Non-Focus Stat

1. **Scorer A needs to record rebound**
   - Tap "More Stats" button
   - Modal opens showing all enabled stats

2. **Select rebound stat**
   ```
   [Points ▼]    [Rebounds ▼]    [Other ▼]
   
   Rebounds:
   [Offensive Rebound]
   [Defensive Rebound]
   ```

3. **Record the stat**
   - Tap "Offensive Rebound"
   - Select Player 23
   - Event recorded

---

## Scenario 5: Edit Event with Audit Trail

### Step 6: Scorer Corrects Mistake

1. **Scorer A notices error**
   - Player 23 actually made a 3PT, not 2PT
   - Tap and hold on the incorrect event

2. **Select edit**
   ```
   [Edit] [Delete]
   ```

3. **Change stat type**
   - Change from "Points (2PT)" to "Points (3PT)"
   - Save

4. **Verify audit trail**
   - Event now shows: "Player 23 - 3PT Points (edited by Scorer A)"
   - Box score updates: Player 23 now has 6 pts (3+3)
   - Audit log shows version history

---

## Scenario 6: View Final Box Score

### Step 7: Post-Game Review

1. **Game ends**
   - Navigate to box score page

2. **View aggregated stats**
   ```
   Final Score: Home 78 - Guest 65
   
   HOME TEAM STATS
   ═══════════════
   Player     PTS   2PT  3PT  REB  OFF  DEF
   ─────────────────────────────────────────
   #23 Jordan  24    3    6    8    3    5
   #33 Pippen  18    4    3    5    2    3
   #91 Rodman  12    2    2   15    7    8
   
   Note: Stats recorded by Scorer A (points) and Scorer B (rebounds)
   ```

3. **Drill down**
   - Tap any player to see per-event breakdown
   - View which scorer recorded each stat

---

## Success Validation

✅ **Test 1**: Create game, configure stats, verify only enabled stats appear  
✅ **Test 2**: Two scorers set different focuses, verify UI customization  
✅ **Test 3**: Record stats simultaneously, verify <500ms sync  
✅ **Test 4**: View box score, verify accurate aggregation  
✅ **Test 5**: Edit event, verify audit trail and version history  

---

## Troubleshooting

### Issue: Stat button not appearing
- **Check**: Is the stat enabled in game configuration?
- **Check**: Is the stat in your primary focus or accessed via "More Stats"?

### Issue: Events not syncing between scorers
- **Check**: Are both scorers active game_scorers?
- **Check**: Is Hasura subscription connected (green dot)?
- **Check**: Network latency (should be <500ms)

### Issue: Can't disable stat
- **Check**: Are there existing events for that stat?
- **Check**: Do you have permission (game owner)?

---

## Next Steps

1. **Season stats aggregation**: Stats tracked across multiple games
2. **Player profiles**: Individual stat history
3. **Advanced analytics**: Per-game efficiency ratings
