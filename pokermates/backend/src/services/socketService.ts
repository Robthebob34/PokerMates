import { Server, Socket } from 'socket.io';
import { roomService } from './roomService';

interface PlayerState {
  userId: string;
  username: string;
  isHost: boolean;
  chips: number;
  socketIds: Set<string>;
}

interface RoomState {
  id: string;
  code: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  players: PlayerState[];
  gameInProgress: boolean;
}

class SocketService {
  private io: Server;
  private rooms: Map<string, RoomState>;
  private socketToUser: Map<string, { userId: string; roomId: string }>;

  constructor(io: Server) {
    this.io = io;
    this.rooms = new Map();
    this.socketToUser = new Map();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log('New client connected:', socket.id);

      socket.on('table_join', async ({ roomId, userId, username }: { roomId: string; userId: string; username: string }) => {
        try {
          if (!roomId || !userId || !username) {
            throw new Error('Missing room or user information');
          }

          const roomState = await this.syncRoomState(roomId);
          if (!roomState) {
            throw new Error('Room not found');
          }

          const member = roomState.players.find((player) => player.userId === userId);
          if (!member) {
            throw new Error('You are not part of this room');
          }

          socket.join(roomId);
          this.socketToUser.set(socket.id, { userId, roomId });
          member.socketIds.add(socket.id);

          socket.emit('table_state', this.serializeRoomState(roomState));
          this.broadcastRoomState(roomId);
        } catch (error) {
          console.error('Error joining table:', error);
          socket.emit('table_error', { message: error instanceof Error ? error.message : 'Failed to join table' });
        }
      });

      socket.on('table_leave', async ({ roomId, userId }: { roomId: string; userId: string }) => {
        await this.handleLeave(socket, roomId, userId);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        const mapping = this.socketToUser.get(socket.id);
        if (!mapping) {
          return;
        }

        const { roomId, userId } = mapping;
        this.handleLeave(socket, roomId, userId, { disconnect: true }).catch((error) => {
          console.error('Error during disconnect cleanup:', error);
        });
      });
    });
  }

  private async handleLeave(socket: Socket, roomId: string, userId: string, options?: { disconnect?: boolean }) {
    try {
      if (!roomId || !userId) {
        return;
      }

      this.socketToUser.delete(socket.id);

      const roomState = this.rooms.get(roomId);
      const player = roomState?.players.find((p) => p.userId === userId);
      if (player) {
        player.socketIds.delete(socket.id);
      }

      await roomService.leaveRoom(roomId, userId);
      const updatedRoom = await this.syncRoomState(roomId);

      socket.leave(roomId);

      if (updatedRoom) {
        this.broadcastRoomState(roomId);
      } else {
        this.rooms.delete(roomId);
      }

      if (!options?.disconnect) {
        socket.emit('table_left', { roomId });
      }
    } catch (error) {
      console.error('Error leaving table:', error);
      socket.emit('table_error', { message: error instanceof Error ? error.message : 'Failed to leave table' });
    }
  }

  private async syncRoomState(roomId: string): Promise<RoomState | null> {
    const details = await roomService.getRoomDetails(roomId);
    if (!details) {
      this.rooms.delete(roomId);
      return null;
    }

    const existing = this.rooms.get(roomId);
    const players: PlayerState[] = details.players.map((player) => {
      const previous = existing?.players.find((p) => p.userId === player.userId);
      return {
        userId: player.userId,
        username: player.username,
        isHost: player.isHost,
        chips: player.chips,
        socketIds: previous?.socketIds ?? new Set<string>(),
      };
    });

        const roomState: RoomState = {
      id: details.id,
      code: details.code,
      name: details.name,
      smallBlind: details.smallBlind,
      bigBlind: details.bigBlind,
      players,
      gameInProgress: false,
    };

    this.rooms.set(roomId, roomState);
    return roomState;
  }

  private broadcastRoomState(roomId: string) {
    const roomState = this.rooms.get(roomId);
    if (!roomState) {
      return;
    }

    this.io.to(roomId).emit('table_state', this.serializeRoomState(roomState));
  }

  private serializeRoomState(roomState: RoomState) {
    return {
      roomId: roomState.id,
      roomCode: roomState.code,
      roomName: roomState.name,
      smallBlind: roomState.smallBlind,
      bigBlind: roomState.bigBlind,
      players: roomState.players.map((player) => ({
        userId: player.userId,
        username: player.username,
        isHost: player.isHost,
        chips: player.chips,
      })),
    };
  }
}

// Export as default
export default SocketService;

