# Basketball Scoring App - Functional Specification

## 1. Introduction
This document outlines the functional requirements for a web-based basketball scoring application. The primary goal is to provide a digital scoring interface for game officials (Scorers) and a real-time display for spectators.

## 2. User Roles

### 2.1 Scorer (Admin)
- **Authentication**:
  - Must log in via **Google** (Social Login) to create or manage games.
  - "Guest Scorer" mode (optional for MVP, restricts data persistence).
- Responsible for accurate tracking of the game state.
- Has full control over the game clock, score, fouls, timeouts, and game flow.
- **Mobile-First Design**: The scorer interface must be fully functional and optimized for mobile devices (large touch targets, no hover states).

### 2.2 Spectator
- View-only access to the game state.
- Needs real-time updates without manual refresh.
- Interface optimized for readability on various devices (mobile, tablet, desktop).
- **Mobile Experience**: Responsive design ensures the scoreboard is legible even on small phone screens.

## 3. Core Features

### 3.1 Game Setup (Pre-Game)
- **Create New Game**:
  - Input Team Names (Home vs. Guest).
  - Configure Game Rules:
    - Period Length (e.g., 10, 12 mins).
    - Number of Periods (e.g., 4 quarters).
    - Overtime rules.
    - Foul limits (personal and team).
    - Timeouts per game/half.
- **Roster Management**:
  - Add players to each team (Name, Number).
  - Mark active starters.

### 3.2 Scorer's Interface (Live Game)
The control center handling high-frequency inputs. **Must work on Mobile.**

#### Mode A: Simple Scorer
Designed for casual games where tracking your own team's players is desired, but the opponent is just a score.
- **Home Team Scoring**:
  - Tapping +2/+3 prompts "Who?" (Quick select from active roster).
  - Tracks individual points and fouls for Home players.
- **Guest Team Scoring**:
  - Simple +1, +2, +3 buttons (no player assignment).
  - Team Fouls tracking only.
- **Game Clock**: Standard Start/Stop/Edit.
- **Undo**: Global undo button.

#### Mode B: Advanced Scorer
Designed for official games, requiring detailed stat tracking.
- **Everything in Simple Mode, plus:**
- **Quick Subs Interface**:
  - **Single-Tap Mode**: Tap 'Sub' -> Tap player on court (out) -> Tap player on bench (in).
  - **Drag-and-Drop Mode**: Drag bench player onto court player to swap instantly.
  - **Mass Subs**: "Clear Bench" or preset lineups for quick swaps.
- **Detailed Stats (Box Score)**:
  - Assists, Rebounds (Off/Def), Steals, Blocks, Turnovers.
- **Shot Charting**: 
  - Tap on court image to record shot location + result (Made/Missed).
- **Violations**:
  - Traveling, Double Dribble, etc. (categorized as Turnovers).

#### Common Scorer Features
- **Possession Arrow**: Toggle.
- **Game Log**:
  - Scrollable play-by-play.
  - Edit/Delete functionality.

#### Share & Connect
- **Game Link Sharing**:
  - **QR Code Display**: A prominent button "Share Game" opens a modal with a large QR code pointing to `https://basket.ls.co.za/game/[id]`.
  - **Copy Link**: Button to copy the spectator URL to clipboard.
  - **WhatsApp/Native Share**: Use `navigator.share` if available for native mobile sharing.

### 3.3 Spectator Interface
A clean, high-visibility display of the current game state, optimized for mobile fans.

#### Essentials (Always Visible / Top Fold)
- **Scoreboard**:
  - Huge Clock & Period Indicator.
  - Team Names & Scores.
  - **Foul Count**: Clear indicator of Team Fouls for current quarter (Bonus/Double Bonus status).
- **Possession Arrow**.

#### Tabs / Lower Section
- **Play-by-Play (Game Log)**: 
  - Real-time scrolling feed of events (e.g., "10:02 - #23 Smith (Home) made 2pt jump shot").
- **Box Score**:
  - **Home Team**: Table showing Points, Fouls, (and Rebounds/Assists/etc if Advanced Mode).
  - **Guest Team**: Total score (and players if tracked).
  - Ability to toggle between active players and full roster.

### 3.4 Team & Roster Management
- **Add Team**:
  - Simple form: Team Name, Short Code (3 letters), Color.
  - Ability to save teams for future games (if logged in).
- **Add Players**:
  - **Quick Entry**: "Name, Number" pairs.
  - **Bulk Paste**: Paste a list like "23 Jordan, 33 Pippen" to auto-parse.
  - **Edit/Delete**: Long press to edit player details or remove from roster.
- **On-Court Management**:
  - **Visual Court**: Drag players from "Bench" list to "Court" list.
  - **Time Tracking**: 
    - App automatically calculates "Minutes Played" based on substitution events and game clock running time.
    - Scorer can see current time-on-court for active players.

## 4. Non-Functional Requirements
- **Responsiveness**: Must work on typical laptop screens (scorers) and mobile phones (spectators).
- **Latency**: Updates from Scorer to Spectator should be near real-time (< 1 second).
- **Reliability**: Use local storage or similar to prevent data loss on browser refresh.
- **Connectivity**: Handle temporary disconnects gracefully (queue actions locally if possible, though MVP can assume stable connection).

## 5. Future Considerations (Post-MVP)
- Shot charts.
- Detailed box scores (rebounds, assists, steals).
- Season/League management.
- Import/Export game data.
