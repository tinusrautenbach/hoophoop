# HoopHoop

![HoopHoop Banner](https://hoophoop.net/og-image.png)

> **Double the game. Live the score.**

HoopHoop is designed to amplify the excitement of local basketball by providing a seamless, real-time scoring platform that connects players, schools, and fans across the digital court.

## 🚀 Hosted Version

Experience the app live at [https://hoophoop.net](https://hoophoop.net)

## ✨ Features

- **Real-time Synchronization**: Instant updates across all connected devices using WebSockets.
- **Comprehensive Scorer Interface**: Manage clock, score, periods, timeouts, and fouls with ease.
- **Responsive Spectator View**: Optimized for mobile and desktop screens.
- **Team Management**: Create and manage teams and rosters.
- **Game Modes**: Support for Simple (score only) and Advanced (player stats) scoring modes.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/)
- **Database**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication**: [Clerk](https://clerk.com/)
- **Real-time**: [Socket.io](https://socket.io/)
- **Styling**: Tailwind CSS

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

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 📬 Contact

For any inquiries, please contact us at [info@hoophoop.net](mailto:info@hoophoop.net).
