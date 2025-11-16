"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.server = exports.app = void 0;
exports.gracefulShutdown = gracefulShutdown;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const db_js_1 = __importDefault(require("./db/db.js"));
const socketService_js_1 = __importDefault(require("./services/socketService.js"));
// Configure environment variables
dotenv_1.default.config();
// Get current file and directory paths in CommonJS
const currentFile = typeof __filename !== 'undefined'
    ? __filename
    : (typeof module !== 'undefined' && module.filename) || '';
const currentDir = typeof __dirname !== 'undefined'
    ? __dirname
    : (typeof module !== 'undefined' && module.filename
        ? path_1.default.dirname(module.filename)
        : '');
// Initialize Express app
const app = (0, express_1.default)();
exports.app = app;
const httpServer = (0, http_1.createServer)(app);
const port = process.env.PORT || 3000;
// Log environment variables for debugging
console.log('Environment Variables:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '***' : 'Not set');
// Middleware with error handling
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});
// CORS configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL?.split(',') || 'http://localhost:3000',
    credentials: true
};
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json());
// Basic health check route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    const staticPath = path_1.default.join(__dirname, '../../frontend/dist');
    console.log('Serving static files from:', staticPath);
    app.use(express_1.default.static(staticPath));
    // Handle React routing, return all requests to React app
    app.get('*', (req, res) => {
        res.sendFile(path_1.default.join(staticPath, 'index.html'));
    });
}
// Initialize Socket.io
try {
    const io = new socket_io_1.Server(httpServer, {
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
    new socketService_js_1.default(io);
    console.log('Socket.IO service initialized');
}
catch (error) {
    console.error('Failed to initialize Socket.IO:', error);
    // Don't exit, continue with HTTP server
}
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});
// Handle 404
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});
// Start the server
const server = httpServer.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
exports.server = server;
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
            await db_js_1.default.$disconnect();
            console.log('Database connection closed');
        }
        catch (error) {
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
//# sourceMappingURL=fixed-server.js.map