# HoopHoop

![HoopHoop Banner](https://hoophoop.net/og-image.png)

> **Double the game. Live the score.**

HoopHoop is a comprehensive basketball scoring and tournament management platform designed to amplify the excitement of local basketball. It provides seamless, real-time scoring that connects players, schools, and fans across the digital court.

## 🚀 Hosted Version

Experience the app live at [https://hoophoop.net](https://hoophoop.net)

## ✨ Features

### 🏀 Game Scoring
- **Real-time Synchronization**: Instant updates across all connected devices using WebSockets
- **Comprehensive Scorer Interface**: Manage clock, score, periods, timeouts, and fouls with ease
- **Dual Game Modes**:
  - Simple Mode: Track team scores, fouls, and timeouts
  - Advanced Mode: Full player statistics (points, fouls, rebounds, assists, steals, blocks)
- **Live Box Score**: Real-time player statistics and team totals
- **Game Log**: Play-by-play event tracking with timestamps
- **Timeout Management**: Track team and official timeouts with automatic clock stoppage
- **Foul Tracking**: Individual player and team foul counts with bonus indicators
- **Period Management**: Support for multiple periods/quarters with configurable length
- **Possession Arrow**: Visual indicator of current ball possession
- **Manual Time Editing**: Adjust game clock when needed

### 👥 Team & Player Management
- **Team Creation**: Create teams with names, colors, and short codes
- **Roster Management**: Add/remove players with jersey numbers
- **Player Profiles**: Track player statistics across games and seasons
- **Team Assignment**: Associate teams with communities/schools
- **Athlete Database**: Searchable player database with first name, surname, and birth date
- **Player Merging**: Merge duplicate player records
- **Jersey Number Tracking**: Historical tracking of player jersey numbers

### 🏢 Community/School Management
- **Community Creation**: Create communities for schools, clubs, or leagues
- **Member Management**: Invite users and assign roles (admin, member)
- **Community Types**: Support for school, club, and league communities
- **Team Assignment**: Assign teams to specific communities
- **Community Games**: View all games associated with a community
- **Community Visibility**: Public, private, or community-only visibility options

### 🎯 Game Organization
- **Game Scheduling**: Schedule games with date, time, and location
- **Game Naming**: Custom names for games (e.g., "Championship Final")
- **Visibility Options**:
  - Private: Invitation only
  - Public: Visible to everyone
  - Community: Visible to community members only
- **Ad-hoc Teams**: Create games without pre-defined teams
- **Roster Auto-population**: Automatically populate rosters from team memberships
- **Multi-Scorer Support**: Multiple users can score the same game simultaneously

### 📊 Statistics & Analytics
- **Live Game Statistics**: Real-time updates during games
- **Player Stats Tracking**: Points, fouls, rebounds, assists, steals, blocks
- **Team Stats**: Score, fouls, timeouts, possession
- **Box Score Generation**: Detailed post-game statistics
- **Stat Recalculation**: Automatic score recalculation when events are deleted/edited
- **Season Tracking**: Track player statistics across multiple games

### 🏆 Tournament Management [IN DEVELOPMENT]
- **Tournament Creation**: Create tournaments with custom formats
- **Tournament Types**:
  - Round Robin
  - Single/Double Elimination
  - Pool + Knockout Hybrid
  - Swiss System
  - Group Stage
- **Pool Stage**: Round robin pools with automatic standings
- **Knockout Brackets**: Auto-generated brackets from pool results
- **Manual Score Entry**: Enter scores for games not scored via app
- **Tournament Awards**: MVP, Best Scorer, Best Defender, All-Tournament Team
- **Standings Calculation**: Automatic standings with tiebreakers

### 📱 Mobile Support [IN DEVELOPMENT]
- **Mobile App**: React Native mobile application (iOS/Android)
- **Offline Support**: Limited offline functionality
- **Push Notifications**: Game updates and invitations

### 🔐 Security & Privacy
- **Row-Level Security**: Database-level access control
- **Authentication**: Secure JWT-based authentication
- **Authorization**: Role-based permission system
- **Data Privacy**: GDPR-compliant data handling
- **Audit Trail**: Complete activity logging for accountability

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) with App Router
- **Database**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication**: [Clerk](https://clerk.com/)
- **Real-time**: [Socket.io](https://socket.io/) with custom server
- **Styling**: Tailwind CSS with custom CSS variables
- **State Management**: Zustand for client-side state
- **Animations**: Framer Motion
- **Mobile**: React Native with Expo

## 🏁 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Clerk account for authentication

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/tinusrautenbach/hoophoop.git
   cd hoophoop
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Copy the example environment file and fill in your credentials:
   ```bash
   cp .env.example .env.local
   ```
   Required variables:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`

4. **Run Database Migrations**
   ```bash
   npx drizzle-kit push
   ```

5. **Start the Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) with your browser.

## 👤 Demo User

To test the application with a pre-configured user:

1.  Create a user in your Clerk Dashboard.
2.  Use the email `demo@hoophoop.net` and password `demo` (or any credentials you prefer for testing).
3.  Sign in with these credentials on the login page.

## 📁 Project Structure

```
hoophoop/
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   ├── db/              # Database schema and config
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions
│   ├── server/          # Socket.io server
│   └── types/           # TypeScript types
├── mobile/              # React Native mobile app
├── spec/               # Implementation documentation
└── drizzle/            # Database migrations
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 📬 Contact

For any inquiries, please contact us at [info@hoophoop.net](mailto:info@hoophoop.net).
