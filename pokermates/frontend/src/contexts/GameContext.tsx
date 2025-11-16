import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

type GameContextType = {
  socket: Socket | null;
  isConnected: boolean;
  roomCode: string | null;
  playerName: string;
  setPlayerName: (name: string) => void;
  joinRoom: (code: string) => Promise<void>;
  createRoom: () => Promise<void>;
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  const ensureUser = async () => {
    const trimmedName = playerName.trim();
    if (!trimmedName) {
      return;
    }

    if (userId) {
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: trimmedName }),
      });

      if (!response.ok) {
        console.error('Failed to authenticate user:', await response.text());
        return;
      }

      const data = await response.json();
      setUserId(data.user.id);
      console.log('Authenticated as user:', data.user);
    } catch (error) {
      console.error('Error while authenticating user:', error);
    }
  };

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io('http://localhost:3000', {
      autoConnect: false,
    });

    socketInstance.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    socketInstance.on('room_joined', (data: { roomCode: string }) => {
      console.log('Joined room:', data.roomCode);
      setRoomCode(data.roomCode);
    });

    setSocket(socketInstance);
    socketInstance.connect();

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const joinRoom = async (code: string) => {
    if (!socket || !playerName.trim()) {
      return;
    }

    await ensureUser();

    socket.emit('join_room', { roomCode: code, username: playerName });
  };

  const createRoom = async () => {
    if (!socket || !playerName.trim()) {
      return;
    }

    await ensureUser();

    socket.emit('create_room', { username: playerName });
  };

  return (
    <GameContext.Provider
      value={{
        socket,
        isConnected,
        roomCode,
        playerName,
        setPlayerName,
        joinRoom,
        createRoom,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};
