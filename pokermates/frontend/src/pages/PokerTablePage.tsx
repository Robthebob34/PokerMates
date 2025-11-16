import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface PlayerInfo {
  userId: string;
  username: string;
  isHost: boolean;
  chips: number;
}

interface TableState {
  roomId: string;
  roomCode: string;
  roomName: string;
  smallBlind: number;
  bigBlind: number;
  players: PlayerInfo[];
}

interface SeatPosition {
  x: number;
  y: number;
}

const PokerTablePage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [tableState, setTableState] = useState<TableState | null>(null);
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'chips' | 'bb'>('chips');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!roomId || loading) {
      return;
    }

    if (!user) {
      navigate('/');
      return;
    }

    const fetchRoom = async () => {
      try {
        setStatus('loading');
        const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? 'Unable to load room');
        }

        const data = await response.json();
        setMaxPlayers(data.room.maxPlayers ?? 8);
        setTableState({
          roomId: data.room.id,
          roomCode: data.room.code,
          roomName: data.room.name,
          smallBlind: data.room.smallBlind,
          bigBlind: data.room.bigBlind,
          players: data.room.players,
        });
        setStatus('ready');
      } catch (err: any) {
        setError(err.message ?? 'Unable to load room');
        setStatus('error');
      }
    };

    void fetchRoom();
  }, [roomId, user, loading, navigate]);

  useEffect(() => {
    if (!roomId || !user || status === 'error') {
      return;
    }

    if (status !== 'ready') {
      return;
    }

    const socket = io(API_BASE_URL, {
      withCredentials: true,
    });
    socketRef.current = socket;

    const joinPayload = {
      roomId,
      userId: user.id,
      username: user.username,
    };

    socket.on('connect', () => {
      socket.emit('table_join', joinPayload);
    });

    socket.on('table_state', (payload: TableState) => {
      setTableState(payload);
    });

    socket.on('table_error', (payload: { message: string }) => {
      setError(payload.message);
      setStatus('error');
    });

    socket.on('table_left', () => {
      socket.disconnect();
    });

    return () => {
      socket.emit('table_leave', joinPayload);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, user, status]);

  const handleLeave = async () => {
    if (!roomId || !user) {
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/api/rooms/${roomId}/leave`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Failed to leave room', err);
    } finally {
      socketRef.current?.emit('table_leave', { roomId, userId: user.id });
      if (window.opener) {
        window.close();
      } else {
        navigate('/');
      }
    }
  };

  const formatStack = (chips: number) => {
    if (displayMode === 'chips' || !tableState?.bigBlind) {
      return `${chips.toLocaleString()} chips`;
    }

    if (tableState.bigBlind <= 0) {
      return `${chips.toLocaleString()} chips`;
    }

    const inBb = chips / tableState.bigBlind;
    return `${inBb.toFixed(2)} BB`;
  };

  const seatPositions: SeatPosition[] = useMemo(() => {
    const count = Math.max(maxPlayers, tableState?.players.length ?? 0);
    const radius = 220;
    const center = { x: 0, y: 0 };

    return Array.from({ length: count }).map((_, index) => {
      const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
      return {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      };
    });
  }, [maxPlayers, tableState?.players.length]);

  const seats = useMemo(() => {
    const players = tableState?.players ?? [];
    return seatPositions.map((position, index) => ({
      position,
      player: players[index] ?? null,
    }));
  }, [seatPositions, tableState?.players]);

  if (status === 'loading' || loading) {
    return (
      <FullScreenWrapper>
        <p>Loading table…</p>
      </FullScreenWrapper>
    );
  }

  if (status === 'error' || !tableState) {
    return (
      <FullScreenWrapper>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Unable to load table</h1>
          <p style={{ marginBottom: '1.5rem', opacity: 0.8 }}>{error ?? 'Unknown error'}</p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '999px',
              border: 'none',
              backgroundColor: '#4299E1',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Back to Lobby
          </button>
        </div>
      </FullScreenWrapper>
    );
  }

  return (
    <FullScreenWrapper>
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: '900px',
        marginBottom: '1.5rem',
        gap: '1rem',
      }}>
        <div>
          <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>Room Code</p>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.2rem' }}>{tableState.roomName}</h1>
          <p style={{ fontFamily: 'monospace', letterSpacing: '0.3em' }}>{tableState.roomCode}</p>
          <p style={{ opacity: 0.75, marginTop: '0.4rem' }}>
            Blinds: {tableState.smallBlind}/{tableState.bigBlind}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => setDisplayMode((prev) => (prev === 'chips' ? 'bb' : 'chips'))}
            style={{
              height: '3rem',
              padding: '0 1.5rem',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: displayMode === 'chips' ? 'rgba(56,178,172,0.2)' : 'transparent',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Show {displayMode === 'chips' ? 'BB' : 'Chips'}
          </button>
          <button
            onClick={handleLeave}
            style={{
              height: '3rem',
              padding: '0 1.75rem',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Leave Table
          </button>
        </div>
      </header>

      <div style={{
        position: 'relative',
        width: '700px',
        height: '450px',
        maxWidth: '90vw',
        maxHeight: '60vh',
        borderRadius: '50% / 35%',
        background: 'radial-gradient(circle at top, #2f855a, #22543d)',
        boxShadow: '0 30px 120px rgba(0, 0, 0, 0.45)',
        border: '6px solid rgba(0, 0, 0, 0.4)',
      }}>
        {seats.map(({ position, player }, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: `calc(50% + ${position.x}px - 70px)`,
              top: `calc(50% + ${position.y}px - 30px)`,
              width: '140px',
              textAlign: 'center',
              color: 'white',
            }}
          >
            <div
              style={{
                padding: '0.75rem',
                borderRadius: '999px',
                backgroundColor: player ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.1)',
                border: player?.userId === user?.id ? '2px solid #f6ad55' : '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                {player ? player.username : 'Empty Seat'}
              </p>
              {player && (
                <>
                  <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                    {player.isHost ? 'Host' : 'Player'}
                  </span>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.2rem', opacity: 0.9 }}>
                    {formatStack(player.chips)}
                  </p>
                </>
              )}
              {!player && (
                <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Waiting...</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </FullScreenWrapper>
  );
};

const FullScreenWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top, #1a202c, #0f172a)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1.5rem',
      padding: '2rem',
    }}
  >
    {children}
  </div>
);

export default PokerTablePage;
