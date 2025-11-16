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
  const tableRef = useRef<HTMLDivElement | null>(null);
  const [tableSize, setTableSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

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
          throw new Error((data as any).error ?? 'Unable to load room');
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
        setError(err?.message ?? 'Unable to load room');
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

  useEffect(() => {
    const updateSize = () => {
      if (tableRef.current) {
        const rect = tableRef.current.getBoundingClientRect();
        setTableSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

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
    if (count <= 0) {
      return [];
    }

    const { width, height } = tableSize;

    // Fallback before the table has been measured: simple responsive circle
    if (!width || !height) {
      const radiusX = 50;
      const radiusY = 50; // push top seats higher and bottom seats lower
      return Array.from({ length: count }).map((_, index) => {
        const angle = (index / count) * 2 * Math.PI - Math.PI / 2;
        return {
          x: 50 + radiusX * Math.cos(angle),
          y: 50 + radiusY * Math.sin(angle),
        };
      });
    }

    // Use the real table proportions so seats follow its current geometry, but
    // with slightly flatter sides than a perfect ellipse (superellipse style).
    const paddingX = Math.max(width * 0.06, 40);
    const paddingY = Math.max(height * 0.08, 32);
    const a = width / 2 - paddingX; // horizontal semi-axis inside the border
    const b = height / 2 - paddingY; // vertical semi-axis inside the border

    const exponent = 4; // >2 flattens the sides and sharpens "corners"
    const verticalScale = 1.12; // push top seats higher and bottom seats lower

    return Array.from({ length: count }).map((_, index) => {
      const angle = (index / count) * 2 * Math.PI - Math.PI / 2;

      const cosT = Math.cos(angle);
      const sinT = Math.sin(angle);

      const xNorm = Math.sign(cosT) * Math.pow(Math.abs(cosT), 2 / exponent);
      const yNorm = Math.sign(sinT) * Math.pow(Math.abs(sinT), 2 / exponent);

      const x = a * xNorm;
      const y = b * yNorm * verticalScale;

      const leftPercent = 50 + (x / width) * 100;
      const topPercent = 50 + (y / height) * 100;

      return {
        x: leftPercent,
        y: topPercent,
      };
    });
  }, [maxPlayers, tableState?.players.length, tableSize]);

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
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          maxWidth: '1200px',
          margin: '0 auto 0.75rem auto',
          gap: '0.75rem',
          padding: '0.55rem 1rem',
          borderRadius: '0.75rem',
          background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.82))',
          border: '1px solid rgba(148,163,184,0.3)',
          boxShadow: '0 12px 30px rgba(15,23,42,0.85)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div>
          <p style={{ opacity: 0.7, fontSize: '0.75rem', marginBottom: '0.15rem' }}>Room Code</p>
          <h1
            style={{
              fontSize: '1.4rem',
              marginBottom: '0.05rem',
              letterSpacing: '0.02em',
            }}
          >
            {tableState.roomName}
          </h1>
          <p
            style={{
              fontFamily: 'monospace',
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
              fontSize: '0.8rem',
              opacity: 0.7,
            }}
          >
            {tableState.roomCode}
          </p>
          <p style={{ opacity: 0.85, marginTop: '0.15rem', fontSize: '0.8rem' }}>
            Blinds: {tableState.smallBlind}/{tableState.bigBlind}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => setDisplayMode((prev) => (prev === 'chips' ? 'bb' : 'chips'))}
            style={{
              height: '2.2rem',
              padding: '0 1.1rem',
              borderRadius: '999px',
              border:
                displayMode === 'chips'
                  ? '1px solid rgba(56,178,172,0.95)'
                  : '1px solid rgba(148,163,184,0.6)',
              background:
                displayMode === 'chips'
                  ? 'linear-gradient(135deg, #38b2ac, #2c7a7b)'
                  : 'transparent',
              color: displayMode === 'chips' ? '#0f172a' : '#e5e7eb',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.8rem',
              letterSpacing: '0.03em',
              boxShadow:
                displayMode === 'chips'
                  ? '0 10px 24px rgba(56,178,172,0.45)'
                  : '0 0 0 rgba(0,0,0,0)',
            }}
          >
            Show {displayMode === 'chips' ? 'BB' : 'Chips'}
          </button>
          <button
            onClick={handleLeave}
            style={{
              height: '2.2rem',
              padding: '0 1.3rem',
              borderRadius: '999px',
              border: '1px solid rgba(248,113,113,0.9)',
              background: 'rgba(15,23,42,0.96)',
              color: '#fecaca',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.8rem',
              letterSpacing: '0.03em',
              boxShadow: '0 10px 26px rgba(248,113,113,0.35)',
            }}
          >
            Leave Table
          </button>
        </div>
      </header>

      <div
        style={{
          position: 'relative',
          width: 'min(1100px, 100vw - 32px)',
          height: 'calc(min(1100px, 100vw - 32px) * 0.55)',
          maxWidth: '100%',
          borderRadius: '50% / 36%',
          background:
            'radial-gradient(circle at 20% 0%, #4ade80 0%, #22c55e 30%, #16a34a 55%, #166534 80%, #14532d 100%)',
          boxShadow: '0 48px 140px rgba(0, 0, 0, 0.8)',
          border: '7px solid rgba(15, 23, 42, 0.97)',
          overflow: 'visible',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '16px',
            borderRadius: 'inherit',
            border: '1px solid rgba(15,23,42,0.72)',
            boxShadow: 'inset 0 26px 55px rgba(0,0,0,0.55)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '0.45rem 1.1rem',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            border: '1px solid rgba(15,23,42,0.75)',
            color: '#022c22',
            fontWeight: 700,
            fontSize: '0.85rem',
            boxShadow: '0 14px 32px rgba(0,0,0,0.7)',
            zIndex: 2,
          }}
        >
          Pot: --
        </div>

        {seats.map(({ position, player }, index) => {
          const isSelf = player?.userId === user?.id;
          const seatDiameter = 'min(14vw, 110px)';
          return (
            <div
              key={index}
              style={{
                position: 'absolute',
                left: `${position.x}%`,
                top: `${position.y}%`,
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                color: 'white',
                zIndex: 1,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: seatDiameter,
                  height: seatDiameter,
                  margin: '0 auto',
                  borderRadius: '999px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: player ? 'rgba(15,23,42,0.94)' : 'rgba(15,23,42,0.75)',
                  border: isSelf
                    ? '2px solid #fbbf24'
                    : '1px solid rgba(148,163,184,0.7)',
                  boxShadow: isSelf
                    ? '0 0 0 3px rgba(251,191,36,0.28), 0 18px 46px rgba(15,23,42,0.98)'
                    : '0 18px 40px rgba(15,23,42,0.98)',
                  backdropFilter: 'blur(7px)',
                }}
              >
                {player?.isHost && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '-0.4rem',
                      right: '-0.4rem',
                      width: '20px',
                      height: '20px',
                      borderRadius: '999px',
                      background: '#facc15',
                      boxShadow: '0 0 0 3px rgba(15,23,42,0.95)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#1f2937',
                    }}
                  >
                    D
                  </div>
                )}

                <p
                  style={{
                    fontWeight: 600,
                    marginBottom: '0.1rem',
                    fontSize: 'clamp(0.8rem, 1.4vw, 0.9rem)',
                  }}
                >
                  {player ? player.username : 'Empty Seat'}
                </p>
                {player && (
                  <>
                    <p
                      style={{
                        fontSize: 'clamp(0.75rem, 1.2vw, 0.85rem)',
                        opacity: 0.9,
                      }}
                    >
                      {formatStack(player.chips)}
                    </p>
                    <p
                      style={{
                        fontSize: 'clamp(0.7rem, 1.1vw, 0.8rem)',
                        marginTop: '0.15rem',
                        opacity: 0.75,
                      }}
                    >
                      {player.isHost ? 'Dealer / Host' : 'Seated'}
                    </p>
                  </>
                )}
                {!player && (
                  <>
                    <p
                      style={{
                        fontSize: 'clamp(0.75rem, 1.2vw, 0.85rem)',
                        opacity: 0.7,
                      }}
                    >
                      Waiting…
                    </p>
                    <p
                      style={{
                        fontSize: 'clamp(0.7rem, 1.1vw, 0.8rem)',
                        opacity: 0.6,
                        marginTop: '0.1rem',
                      }}
                    >
                      Empty seat
                    </p>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </FullScreenWrapper>
  );
};

const FullScreenWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle at top left, #020617, #020617 45%, #020617 100%)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: '1rem',
      padding: '0.75rem 1rem 1.25rem 1rem',
      boxSizing: 'border-box',
    }}
  >
    {children}
  </div>
);

export default PokerTablePage;
