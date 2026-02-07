# Basketball Scoring App

A web-based basketball scoring application with real-time updates for spectators.

## Overview
This project aims to provide a reliable, easy-to-use digital scoreboard for basketball games. It features a dedicated interface for scorers to manage the game state (score, time, fouls) and a real-time view for spectators to follow the action on any device.

## Documentation
- [Functional Main Specification](spec/functional.md)
- [Technical Specification](spec/technical.md)
- [Implementation Plan](spec/implementation_plan.md)

## Getting Started (Planned)
1. Install dependencies: `npm install`
2. Run development server: `npm run dev`
3. Access Scorer View: `http://localhost:3000/game/[id]/scorer`
4. Access Spectator View: `http://localhost:3000/game/[id]`

## Features
- **Real-time Synchronization**: Instant updates across all connected devices.
- **Comprehensive Control**: Manage clock, score, periods, timeouts, and fouls.
- **Responsive Design**: Works on tablets (scorers) and phones (spectators).
