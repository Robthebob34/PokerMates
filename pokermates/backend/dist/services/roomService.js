"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomService = void 0;
const client_1 = require("@prisma/client");
const roomCodeGenerator_js_1 = require("../utils/roomCodeGenerator.js");
const prisma = new client_1.PrismaClient();
exports.roomService = {
    async createRoom({ roomName, hostUsername, maxPlayers = 8 }) {
        const roomCode = (0, roomCodeGenerator_js_1.generateRoomCode)();
        return await prisma.$transaction(async (tx) => {
            // Create the room
            const room = await tx.room.create({
                data: {
                    code: roomCode,
                    name: roomName,
                    maxPlayers,
                    isActive: true,
                },
            });
            // Create the host user
            const user = await tx.user.upsert({
                where: { username: hostUsername },
                update: {},
                create: { username: hostUsername },
            });
            // Add host to the room
            const roomPlayer = await tx.roomPlayer.create({
                data: {
                    userId: user.id,
                    roomId: room.id,
                    isHost: true,
                    chips: 1000, // Starting chips
                },
                include: {
                    user: true,
                    room: true,
                },
            });
            return {
                room,
                user,
                roomPlayer,
            };
        });
    },
    async joinRoom(roomCode, username) {
        // Find the room by code
        const room = await prisma.room.findUnique({
            where: { code: roomCode },
        });
        if (!room || !room.isActive) {
            throw new Error('Room not found or is not active');
        }
        // Check if room is full
        const playerCount = await prisma.roomPlayer.count({
            where: { roomId: room.id },
        });
        if (playerCount >= room.maxPlayers) {
            throw new Error('Room is full');
        }
        return await prisma.$transaction(async (tx) => {
            // Create or get the user
            const user = await tx.user.upsert({
                where: { username },
                update: {},
                create: { username },
            });
            // Check if user is already in the room
            const existingPlayer = await tx.roomPlayer.findFirst({
                where: {
                    userId: user.id,
                    roomId: room.id,
                },
            });
            if (existingPlayer) {
                return {
                    room,
                    user,
                    roomPlayer: existingPlayer,
                    isNewPlayer: false,
                };
            }
            // Add user to the room
            const roomPlayer = await tx.roomPlayer.create({
                data: {
                    userId: user.id,
                    roomId: room.id,
                    chips: 1000, // Starting chips
                    isHost: false,
                },
                include: {
                    user: true,
                },
            });
            return {
                room,
                user,
                roomPlayer,
                isNewPlayer: true,
            };
        });
    },
    async getRoomPlayers(roomId) {
        return await prisma.roomPlayer.findMany({
            where: { roomId },
            include: {
                user: true,
            },
        });
    },
};
//# sourceMappingURL=roomService.js.map