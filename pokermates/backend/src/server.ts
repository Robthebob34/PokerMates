import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import cookieParser from 'cookie-parser';
import prisma from './db/db';
import SocketService from './services/socketService';
import authRoutes from './auth/authRoutes';
import roomRoutes from './rooms/roomRoutes';
import { attachUserFromCookie } from './auth/authMiddleware';

// Debug import
console.log('SocketService imported:', { 
  isClass: typeof SocketService === 'function',
  isConstructor: typeof SocketService === 'function' && 'prototype' in SocketService,
  name: SocketService?.name
});

// Configure environment variables
dotenv.config();

// Initialize Express app
const app: Express = express();
const httpServer = createServer(app);
const port = process.env.PORT || 3000;

async function resetRoomsOnStartup() {
  try {
    await prisma.game.deleteMany();
    await prisma.roomPlayer.deleteMany();
    await prisma.room.deleteMany();
    console.log('Room data cleared on startup');
  } catch (error) {
    console.error('Failed to reset rooms on startup:', error);
  }
}

void resetRoomsOnStartup();

// Log environment variables for debugging
console.log('Environment Variables:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '***' : 'Not set');

// Middleware with error handling
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Enable CORS for all routes
const corsOptions = {
  origin: 'http://localhost:5173', // Autoriser uniquement le frontend en développement
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(attachUserFromCookie);

// Auth routes
app.use('/api/auth', authRoutes);

// Room routes
app.use('/api/rooms', roomRoutes);

// Basic health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ 
    message: 'Bienvenue sur l\'API PokerMates',
    status: 'en ligne',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      socket: '/socket.io/'
    }
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../../frontend/dist');
  console.log('Serving static files from:', staticPath);
  
  app.use(express.static(staticPath));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
}

// Initialize Socket.io
try {
  const io = new (Server as any)(httpServer, {
    cors: {
      origin: 'http://localhost:5173', // Même origine que la configuration CORS principale
      methods: ['GET', 'POST'],
      credentials: true
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    }
  });

  // Initialize socket service
  const socketService = new SocketService(io);
  console.log('Socket.IO service initialized');
} catch (error) {
  console.error('Failed to initialize Socket.IO:', error);
  // Don't exit, continue with HTTP server
}

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Handle 404
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// Start the server
const server = httpServer.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Attempt to gracefully shut down
  gracefulShutdown();
});

// Graceful shutdown
function gracefulShutdown() {
  console.log('Shutting down gracefully...');
  
  // Close the HTTP server
  server.close(async () => {
    console.log('HTTP server closed');
    
    // Close Prisma client
    try {
      await prisma.$disconnect();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
    
    process.exit(0);
  });
  
  // Force close after timeout
  setTimeout(() => {
    console.error('Force shutdown after timeout');
    process.exit(1);
  }, 5000);
}

// Listen for shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Export for potential programmatic usage
export { app, server, gracefulShutdown };
