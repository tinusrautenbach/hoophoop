# Basketball Scoring App - Implementation Plan

## Phase 1: Foundation & Data Layer (Done)
- [x] 1.1 Project Scaffolding
- [x] 1.2 Schema Design
- [x] 1.3 Database Setup
- [x] 1.4 API Core

## Phase 2: Game Setup & Real-time (Done)
- [x] 2.1 Game Creation UI
- [x] 2.2 Live Game Sync (Socket.io)
- [x] 2.5.1 New Tables (Migration)
- [x] 2.5.2 API - Team Management (CRUD verified)
- [x] 2.5.3 UI - Team Manager (Add/Remove members)
- [ ] 2.5.4 Advanced Team UI (Bulk Paste, Color Picker)

## Phase 3: Frontend Core (Scorer Views)
- [x] **3.1 Layout & Mobile Design**:
  - [x] Scorer Mode Selection (Simple vs Advanced) on Game Create.
- [x] **3.1.1 Mode A: Simple Scorer UI**:
  - [x] Integrated points-first scoring buttons.
  - [x] Fouls tracking per team with period-based resets.
- [x] **3.1.2 Mode B: Advanced Scorer**:
  - [x] Bench substitutions with DnD.
  - [x] Action palette + Quick Scoring buttons.
  - [x] Shot chart integration.
- [x] **3.2 Shared Component Polish**:
  - [x] **3.2.1 Game Clock**: Period & Clock management with local sync and server backup.
  - [ ] **3.2.2 Game Log**: 
    - [x] Vertical feed at bottom.
    - [ ] Expandable action items.
    - [ ] Edit/Delete modal for individual events.
  - [x] **3.2.3 Status Indicators**: Possession arrow, Foul Count alerts (Bonus indicators).
  - [x] **3.2.4 Points-First Flow**: Support for clicking points then selecting player/team.
- [ ] **3.3 Roster Enforcement & Positioning**:
  - [x] Auto-populate game roster from team ID on game creation (API).
  - [ ] Enforce roster requirement on game start button.
  - [ ] Logic to ensure owner's team is always Home (Left).

## Phase 4: Share & Public Views (Done)
- [x] 4.1 Live Scoreboard (Public)
- [x] 4.2 QR Code Sharing

## Phase 5: Stats & Finalization
- [ ] 5.1 Game Summary
- [ ] 5.2 Season Statistics
