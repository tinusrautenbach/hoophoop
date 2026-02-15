# Detailed Test Report

**Date**: 2026-02-15 11:58:51

## ❌ Failures

### src/app/api/communities/[id]/__tests__/route.test.ts
- **should return community for owner**
  ```
  expected 500 to be 200 // Object.is equality
  ```
- **should return community for member**
  ```
  expected 500 to be 200 // Object.is equality
  ```
- **should include teams and games in response**
  ```
  expected 500 to be 200 // Object.is equality
  ```

### src/app/api/communities/[id]/invite/__tests__/route.test.ts
- **should allow admin to create invite**
  ```
  expected 500 to be 200 // Object.is equality
  ```
- **should allow owner to create invite**
  ```
  expected 500 to be 200 // Object.is equality
  ```

### src/app/api/teams/__tests__/integration.test.ts
- **should fetch team members via API**
  ```
  fetch failed
  ```
- **should add a member via API**
  ```
  fetch failed
  ```
- **should fetch members after adding**
  ```
  fetch failed
  ```

### src/app/api/teams/__tests__/teams.test.ts
- **should return user teams when authenticated**
  ```
  expected 500 to be 200 // Object.is equality
  ```

### src/app/api/tournaments/[id]/games/[gameId]/__tests__/route.test.ts
- **should update game score**
  ```
  expected undefined to be 85 // Object.is equality
  ```
- **should return 400 if scores are missing**
  ```
  expected 500 to be 400 // Object.is equality
  ```

### tests/load/load-test-10k-spectators-100-games.test.ts
- **should handle 10K spectators across 100 games with 1 event/second per game for 30 seconds**
  ```
  expected 4338 to be greater than or equal to 9500
  ```
- **should handle rapid connection and disconnection cycles**
  ```
  expected 5659 to be less than 250
  ```

