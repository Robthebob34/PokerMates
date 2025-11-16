import type { Prisma } from '@prisma/client';
import prisma from '../db/db';
import { generateRoomCode } from '../utils/roomCodeGenerator';

export const MIN_BUYIN_BB = 20;
export const MAX_BUYIN_BB = 200;

export const getBuyInRange = (bigBlind: number) => {
  const min = bigBlind * MIN_BUYIN_BB;
  const max = bigBlind * MAX_BUYIN_BB;
  return { min, max };
};

type RoomWithPlayers = Prisma.RoomGetPayload<{
  include: {
    players: {
      include: {
        user: true;
      };
    };
  };
}>;

const mapRoomDetails = (room: RoomWithPlayers) => {
  const { min, max } = getBuyInRange(room.bigBlind);

  return {
    id: room.id,
    code: room.code,
    name: room.name,
    maxPlayers: room.maxPlayers,
    smallBlind: room.smallBlind,
    bigBlind: room.bigBlind,
    buyInRange: { min, max },
    players: room.players
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((player) => ({
        roomPlayerId: player.id,
        userId: player.userId,
        username: player.user.username,
        isHost: player.isHost,
        chips: player.chips,
        buyIn: player.buyIn,
      })),
  };
};

interface CreateRoomParams {
  roomName: string;
  hostUserId: string;
  maxPlayers?: number;
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
}

interface JoinRoomParams {
  roomCode: string;
  userId: string;
  buyIn: number;
}

export const roomService = {
  async createRoom({
    roomName,
    hostUserId,
    maxPlayers = 8,
    smallBlind,
    bigBlind,
    buyIn,
  }: CreateRoomParams) {
    const roomCode = generateRoomCode();
    
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const hostUser = await tx.user.findUnique({ where: { id: hostUserId } });
      if (!hostUser) {
        throw new Error('Host user not found');
      }

      const { min, max } = getBuyInRange(bigBlind);
      if (buyIn < min || buyIn > max) {
        throw new Error(`Buy-in must be between ${min} and ${max} chips`);
      }

      if (hostUser.chips < buyIn) {
        throw new Error('Insufficient chips to cover the selected buy-in');
      }

      const updatedHost = await tx.user.update({
        where: { id: hostUserId },
        data: {
          chips: { decrement: buyIn },
        },
      });

      // Create the room
      const room = await tx.room.create({
        data: {
          code: roomCode,
          name: roomName,
          maxPlayers,
          smallBlind,
          bigBlind,
          isActive: true,
        },
      });

      // Add host to the room
      const roomPlayer = await tx.roomPlayer.create({
        data: {
          userId: hostUser.id,
          roomId: room.id,
          isHost: true,
          chips: buyIn,
          buyIn,
        },
        include: {
          user: true,
          room: true,
        },
      });

      return {
        room,
        user: updatedHost,
        roomPlayer,
      };
    });
  },

  async joinRoom({ roomCode, userId, buyIn }: JoinRoomParams) {
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

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const { min, max } = getBuyInRange(room.bigBlind);
    if (buyIn < min || buyIn > max) {
      throw new Error(`Buy-in must be between ${min} and ${max} chips`);
    }

    if (user.chips < buyIn) {
      throw new Error('Insufficient chips to cover the selected buy-in');
    }

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Ensure we have the latest user info (optional re-fetch inside tx)
      const ensuredUser = await tx.user.findUnique({ where: { id: userId } });
      if (!ensuredUser) {
        throw new Error('User not found');
      }

      // Check if user is already in the room
      const existingPlayer = await tx.roomPlayer.findFirst({
        where: {
          userId: ensuredUser.id,
          roomId: room.id,
        },
      });

      if (existingPlayer) {
        return {
          room,
          user: ensuredUser,
          roomPlayer: existingPlayer,
          isNewPlayer: false,
        };
      }

      const updatedUser = await tx.user.update({
        where: { id: ensuredUser.id },
        data: {
          chips: { decrement: buyIn },
        },
      });

      // Add user to the room
      const roomPlayer = await tx.roomPlayer.create({
        data: {
          userId: ensuredUser.id,
          roomId: room.id,
          chips: buyIn,
          buyIn,
          isHost: false,
        },
        include: {
          user: true,
        },
      });

      return {
        room,
        user: updatedUser,
        roomPlayer,
        isNewPlayer: true,
      };
    });
  },

  async getRoomPlayers(roomId: string) {
    return await prisma.roomPlayer.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: true,
      },
    });
  },

  async getRoomDetails(roomId: string) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        players: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: true,
          },
        },
      },
    });

    if (!room) {
      return null;
    }

    return mapRoomDetails(room);
  },

  async getRoomByCode(roomCode: string) {
    const room = await prisma.room.findUnique({
      where: { code: roomCode },
      include: {
        players: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: true,
          },
        },
      },
    });

    if (!room) {
      return null;
    }

    return mapRoomDetails(room);
  },

  async leaveRoom(roomId: string, userId: string) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existingPlayer = await tx.roomPlayer.findFirst({
        where: { roomId, userId },
      });

      if (!existingPlayer) {
        const room = await tx.room.findUnique({
          where: { id: roomId },
          include: {
            players: {
              orderBy: { createdAt: 'asc' },
              include: { user: true },
            },
          },
        });
        return room ? mapRoomDetails(room) : null;
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          chips: { increment: existingPlayer.chips },
        },
      });

      await tx.roomPlayer.delete({ where: { id: existingPlayer.id } });

      const remainingPlayers = await tx.roomPlayer.findMany({
        where: { roomId },
        orderBy: { createdAt: 'asc' },
      });

      if (remainingPlayers.length === 0) {
        await tx.room.delete({ where: { id: roomId } });
        return null;
      }

      const hasHost = remainingPlayers.some((player) => player.isHost);
      if (!hasHost) {
        const newHost = remainingPlayers[0];
        if (newHost) {
          await tx.roomPlayer.update({
            where: { id: newHost.id },
            data: { isHost: true },
          });
        }
      }

      const room = await tx.room.findUnique({
        where: { id: roomId },
        include: {
          players: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: true,
            },
          },
        },
      });

      return room ? mapRoomDetails(room) : null;
    });
  },

  async listActiveRooms() {
    const rooms = await prisma.room.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            players: true,
          },
        },
      },
    });

    return rooms.map((room) => ({
      id: room.id,
      name: room.name,
      code: room.code,
      maxPlayers: room.maxPlayers,
      smallBlind: room.smallBlind,
      bigBlind: room.bigBlind,
      playerCount: room._count.players,
      buyInRange: getBuyInRange(room.bigBlind),
    }));
  },
};
