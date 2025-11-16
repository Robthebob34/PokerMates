import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from './db/db.js';
import SocketService from './services/socketService.js';

// Configure environment variables
dotenv.config();

// Get current file and directory paths in CommonJS
const currentFile = typeof __filename !== 'undefined' 
  ? __filename 
  : (typeof module !== 'undefined' && module.filename) || '';
const currentDir = typeof __dirname !== 'undefined' 
  ? __dirname 
  : (typeof module !== 'undefined' && module.filename 
      ? path.dirname(module.filename) 
      : '');
// Initialize Express app
const app: Express = express();
const httpServer = createServer(app);
const port = process.env.PORT || 3000;

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

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL?.split(',') || 'http://localhost:3000',
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Basic health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
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
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL?.split(',') || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true,
    }
  });

  // Initialize socket service
  new SocketService(io);
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
