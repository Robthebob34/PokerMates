const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

// Initialize Express app
const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 3000;

// CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Simple in-memory storage
const rooms = new Map();
const players = new Map();

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle joining a room
  socket.on('join_room', ({ roomCode, username }) => {
    console.log(`User ${socket.id} (${username}) is joining room ${roomCode}`);
    
    // Create room if it doesn't exist
    if (!rooms.has(roomCode)) {
      rooms.set(roomCode, {
        id: roomCode,
        players: new Map(),
        gameInProgress: false
      });
    }
    
    const room = rooms.get(roomCode);
    
    // Add player to room
    room.players.set(socket.id, {
      id: socket.id,
      username,
      isHost: room.players.size === 0, // First player is host
      chips: 1000,
      socketId: socket.id
    });
    
    // Add player to socket room
    socket.join(roomCode);
    
    // Store player data
    players.set(socket.id, {
      id: socket.id,
      username,
      roomCode
    });
    
    // Notify room about the new player
    io.to(roomCode).emit('player_joined', {
      playerId: socket.id,
      username,
      players: Array.from(room.players.values())
    });
    
    console.log(`User ${socket.id} (${username}) joined room ${roomCode}`);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    const player = players.get(socket.id);
    if (!player) return;
    
    const { roomCode } = player;
    const room = rooms.get(roomCode);
    
    if (room) {
      // Remove player from room
      room.players.delete(socket.id);
      
      // If room is empty, delete it
      if (room.players.size === 0) {
        rooms.delete(roomCode);
      } else {
        // Notify remaining players
        io.to(roomCode).emit('player_left', {
          playerId: socket.id,
          players: Array.from(room.players.values())
        });
      }
    }
    
    // Remove player from players map
    players.delete(socket.id);
  });
  
  // Handle chat messages
  socket.on('send_message', ({ roomCode, username, message }) => {
    io.to(roomCode).emit('receive_message', {
      username,
      message,
      timestamp: new Date().toISOString()
    });
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
httpServer.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`CORS enabled for: http://localhost:5173`);
});
