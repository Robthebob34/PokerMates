import { Router, type Request, type Response } from 'express';
import type { AuthRequest } from '../auth/authMiddleware';
import { requireAuth } from '../auth/authMiddleware';
import { roomService } from '../services/roomService';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const rooms = await roomService.listActiveRooms();
    return res.status(200).json({ rooms });
  } catch (error: any) {
    console.error('Error in GET /api/rooms:', error);
    return res.status(500).json({ error: error.message ?? 'Failed to load rooms' });
  }
});

router.get('/:roomId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { roomId } = req.params as { roomId: string };
    const room = await roomService.getRoomDetails(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const isMember = room.players.some((player) => player.userId === req.user?.id);
    if (!isMember) {
      return res.status(403).json({ error: 'You are not part of this room' });
    }

    return res.status(200).json({ room });
  } catch (error: any) {
    console.error('Error in GET /api/rooms/:roomId:', error);
    return res.status(400).json({ error: error.message ?? 'Failed to fetch room' });
  }
});

router.get('/code/:roomCode', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { roomCode } = req.params as { roomCode: string };
    const room = await roomService.getRoomByCode(roomCode.toUpperCase());

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const isMember = room.players.some((player) => player.userId === req.user?.id);
    if (room.players.length >= room.maxPlayers && !isMember) {
      return res.status(400).json({ error: 'Room is full' });
    }

    return res.status(200).json({ room });
  } catch (error: any) {
    console.error('Error in GET /api/rooms/code/:roomCode:', error);
    return res.status(400).json({ error: error.message ?? 'Failed to fetch room' });
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, maxPlayers = 8, smallBlind, bigBlind, buyIn } = req.body as {
      name?: string;
      maxPlayers?: number;
      smallBlind?: number;
      bigBlind?: number;
      buyIn?: number;
    };

    const trimmedName = name?.trim();
    if (!trimmedName) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    if (typeof smallBlind !== 'number' || typeof bigBlind !== 'number') {
      return res.status(400).json({ error: 'Blinds must be provided' });
    }

    if (smallBlind <= 0 || bigBlind <= smallBlind) {
      return res.status(400).json({ error: 'Invalid blind values' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (typeof buyIn !== 'number') {
      return res.status(400).json({ error: 'Buy-in is required' });
    }

    const result = await roomService.createRoom({
      roomName: trimmedName,
      hostUserId: req.user.id,
      maxPlayers,
      smallBlind,
      bigBlind,
      buyIn,
    });

    return res.status(201).json({
      room: result.room,
      roomPlayer: result.roomPlayer,
    });
  } catch (error: any) {
    console.error('Error in POST /api/rooms:', error);
    return res.status(400).json({ error: error.message ?? 'Failed to create room' });
  }
});

router.post('/join', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { code, buyIn } = req.body as { code?: string; buyIn?: number };
    const trimmedCode = code?.trim().toUpperCase();

    if (!trimmedCode) {
      return res.status(400).json({ error: 'Room code is required' });
    }

    if (typeof buyIn !== 'number') {
      return res.status(400).json({ error: 'Buy-in is required' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await roomService.joinRoom({ roomCode: trimmedCode, userId: req.user.id, buyIn });

    return res.status(200).json({
      room: result.room,
      roomPlayer: result.roomPlayer,
      isNewPlayer: result.isNewPlayer,
    });
  } catch (error: any) {
    console.error('Error in POST /api/rooms/join:', error);
    return res.status(400).json({ error: error.message ?? 'Failed to join room' });
  }
});

router.post('/:roomId/leave', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { roomId } = req.params as { roomId: string };
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const room = await roomService.leaveRoom(roomId, req.user.id);

    return res.status(200).json({ room });
  } catch (error: any) {
    console.error('Error in POST /api/rooms/:roomId/leave:', error);
    return res.status(400).json({ error: error.message ?? 'Failed to leave room' });
  }
});

export default router;
