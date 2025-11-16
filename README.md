# PokerMates - Real-time Texas Hold'em Poker

A real-time web application for playing Texas Hold'em poker with friends in private rooms.

## Features

- Create or join private poker rooms with a unique code
- Real-time gameplay with WebSocket support
- Support for up to 8 players per room
- Automatic game flow (dealing, betting rounds, pot management)
- Responsive UI built with React and Tailwind CSS
- Secure WebSocket connections

## Tech Stack

### Backend

- Node.js with TypeScript
- Express.js for REST API
- Socket.IO for real-time communication
- Prisma ORM for database access
- SQLite for development (can be configured for PostgreSQL in production)

### Frontend

- React with TypeScript
- Vite for fast development and building
- Tailwind CSS for styling
- Socket.IO client for real-time updates

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/pokermates.git
   cd pokermates
   ```

2. Install dependencies for both frontend and backend:
   ```bash
   # Install backend dependencies
   cd backend
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. Set up environment variables:
   - Create a `.env` file in the `backend` directory based on `.env.example`
   - Create a `.env` file in the `frontend` directory based on `.env.example`

### Running the Application

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. In a new terminal, start the frontend development server:
   ```bash
   cd frontend
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:3000`

### Database Setup

For development, the application uses SQLite by default. The database file will be created automatically when you start the server.

To apply database migrations:

```bash
cd backend
npx prisma migrate dev --name init
```

### Production Build

To create a production build:

```bash
# Build the frontend
cd frontend
npm run build

# The backend serves the frontend in production
# Make sure to set NODE_ENV=production when starting the server
cd ../backend
NODE_ENV=production npm start
```

## Project Structure

```
pokermates/
├── backend/               # Backend server
│   ├── src/
│   │   ├── db/           # Database configuration and models
│   │   ├── services/     # Business logic services
│   │   ├── utils/        # Utility functions
│   │   └── server.ts     # Main server file
│   ├── prisma/           # Prisma schema and migrations
│   └── package.json
│
└── frontend/             # Frontend React application
    ├── public/           # Static files
    ├── src/
    │   ├── components/   # Reusable UI components
    │   ├── hooks/        # Custom React hooks
    │   ├── pages/        # Page components
    │   ├── services/     # API and WebSocket services
    │   ├── store/        # State management
    │   ├── types/        # TypeScript type definitions
    │   └── App.tsx       # Main App component
    └── package.json
```

## API Documentation

### WebSocket Events

#### Client to Server

- `join_room`: Join a poker room
  ```typescript
  {
    roomCode: string;
    username: string;
  }
  ```

- `start_game`: Start a new game (host only)
  ```typescript
  {
    roomId: string;
  }
  ```

- `player_action`: Player makes a move
  ```typescript
  {
    roomId: string;
    playerId: string;
    action: 'fold' | 'check' | 'call' | 'raise';
    amount?: number; // Required for 'raise' action
  }
  ```

#### Server to Client

- `player_joined`: A new player joined the room
- `player_left`: A player left the room
- `game_started`: A new game has started
- `game_state`: Current game state update
- `player_action`: A player made a move
- `error`: Error message

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
