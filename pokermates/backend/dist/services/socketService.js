"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class SocketService {
    constructor(io) {
        this.io = io;
        this.rooms = new Map();
        this.playerSockets = new Map();
        this.playerRooms = new Map();
        this.roomSockets = new Map();
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            console.log('New client connected:', socket.id);
            // Handle joining a room
            socket.on('join_room', async ({ roomCode, username }) => {
                try {
                    // Get room state
                    const roomState = await this.getOrCreateRoom(roomCode, 'Poker Room'); // Default room name
                    if (!roomState) {
                        throw new Error('Failed to create or join room');
                    }
                    // Add player to the room
                    const currentRoomState = roomState;
                    const player = {
                        id: socket.id, // In a real app, use a proper user ID
                        username,
                        isHost: currentRoomState.players.length === 0, // First player is host
                        chips: 1000, // Starting chips
                        socketId: socket.id,
                    };
                    currentRoomState.players.push(player);
                    this.playerSockets.set(socket.id, player.id);
                    this.playerRooms.set(player.id, roomState.id);
                    // Join the socket room
                    const roomId = roomState.id;
                    socket.join(roomId);
                    // Track socket in room
                    if (!this.roomSockets.has(roomId)) {
                        this.roomSockets.set(roomId, new Set());
                    }
                    this.roomSockets.get(roomId)?.add(socket.id);
                    // Notify the room that a player has joined
                    this.io.to(currentRoomState.id).emit('player_joined', {
                        room: {
                            id: currentRoomState.id,
                            code: currentRoomState.code,
                            name: currentRoomState.name,
                        },
                        player,
                        players: currentRoomState.players,
                    });
                    // Send the current room state to the new player
                    socket.emit('room_state', {
                        room: {
                            id: currentRoomState.id,
                            code: currentRoomState.code,
                            name: currentRoomState.name,
                        },
                        players: currentRoomState.players,
                        gameInProgress: currentRoomState.gameInProgress,
                    });
                }
                catch (error) {
                    console.error('Error joining room:', error);
                    socket.emit('error', { message: error instanceof Error ? error.message : 'Failed to join room' });
                }
            });
            // Handle starting a game
            socket.on('start_game', async ({ roomId }) => {
                try {
                    const roomState = this.rooms.get(roomId);
                    if (!roomState) {
                        throw new Error('Room not found');
                    }
                    // In a real app, you would validate that the user is the host
                    // and that there are enough players
                    if (roomState.players.length < 2) {
                        throw new Error('Need at least 2 players to start a game');
                    }
                    roomState.gameInProgress = true;
                    // Notify all players that the game is starting
                    this.io.to(roomId).emit('game_started', {
                        roomId,
                        players: roomState.players,
                        // In a real game, you would include initial game state here
                    });
                }
                catch (error) {
                    console.error('Error starting game:', error);
                    socket.emit('error', { message: error instanceof Error ? error.message : 'Failed to start game' });
                }
            });
            // Handle player actions
            socket.on('player_action', async ({ roomId, playerId, action, amount }) => {
                try {
                    const roomState = this.rooms.get(roomId);
                    if (!roomState) {
                        throw new Error('Room not found');
                    }
                    // In a real app, you would validate the player's action
                    // and update the game state accordingly
                    // For now, just broadcast the action to all players in the room
                    this.io.to(roomId).emit('player_action', {
                        playerId,
                        action,
                        amount,
                        timestamp: new Date().toISOString(),
                    });
                }
                catch (error) {
                    console.error('Error processing player action:', error);
                    socket.emit('error', {
                        message: error instanceof Error ? error.message : 'Failed to process player action'
                    });
                }
            });
            // Handle disconnection
            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
                const playerId = this.playerSockets.get(socket.id);
                if (!playerId)
                    return;
                const roomId = this.playerRooms.get(playerId);
                if (!roomId)
                    return;
                const roomState = this.rooms.get(roomId);
                if (!roomState)
                    return;
                try {
                    // Remove the player from the room
                    roomState.players = roomState.players.filter((p) => p.id !== playerId);
                    // If the room is empty, clean it up
                    if (roomState.players.length === 0) {
                        this.rooms.delete(roomId);
                    }
                    else {
                        // Notify remaining players that a player has left
                        this.io.to(roomId).emit('player_left', {
                            playerId,
                            players: roomState.players,
                        });
                        // If the host left, assign a new host
                        const hostLeft = !roomState.players.some((p) => p.isHost);
                        if (hostLeft && roomState.players.length > 0) {
                            const newHost = roomState.players[0];
                            if (newHost) {
                                newHost.isHost = true;
                                this.io.to(roomId).emit('new_host', {
                                    newHostId: newHost.id,
                                });
                            }
                        }
                    }
                }
                catch (error) {
                    console.error('Error during player disconnect cleanup:', error);
                }
                // Clean up player mappings
                this.playerSockets.delete(socket.id);
                this.playerRooms.delete(playerId);
                // Remove socket from room tracking
                const roomSockets = this.roomSockets.get(roomId);
                if (roomSockets) {
                    roomSockets.delete(socket.id);
                    if (roomSockets.size === 0) {
                        this.roomSockets.delete(roomId);
                    }
                }
            });
        });
    }
    async getOrCreateRoom(roomCode, roomName) {
        // First check in memory
        for (const [_, room] of this.rooms.entries()) {
            if (room.code === roomCode) {
                return room;
            }
        }
        try {
            // Try to find in database
            const existingRoom = await prisma.room.findUnique({
                where: { code: roomCode },
                include: {
                    players: {
                        include: {
                            user: true,
                        },
                    },
                },
            });
            if (existingRoom) {
                const roomState = {
                    id: existingRoom.id,
                    code: existingRoom.code,
                    name: existingRoom.name,
                    players: existingRoom.players.map((p) => ({
                        id: p.userId,
                        username: p.user.username,
                        isHost: p.isHost,
                        chips: p.chips,
                        socketId: '', // Will be set when the player connects
                    })),
                    gameInProgress: false, // You would check for active games in a real app
                };
                this.rooms.set(roomState.id, roomState);
                return roomState;
            }
            // Create a new room in the database
            const newRoom = await prisma.room.create({
                data: {
                    code: roomCode,
                    name: roomName,
                    maxPlayers: 8,
                    isActive: true,
                },
            });
            const newRoomState = {
                id: newRoom.id,
                code: newRoom.code,
                name: newRoom.name,
                players: [],
                gameInProgress: false,
            };
            this.rooms.set(newRoomState.id, newRoomState);
            return newRoomState;
        }
        catch (error) {
            console.error('Error getting or creating room:', error);
            // Fallback to in-memory room if database fails
            const fallbackRoom = {
                id: `temp_${Date.now()}`,
                code: roomCode,
                name: roomName,
                players: [],
                gameInProgress: false,
            };
            this.rooms.set(fallbackRoom.id, fallbackRoom);
            return fallbackRoom;
        }
    }
}
// Export as default
exports.default = SocketService;
//# sourceMappingURL=socketService.js.map