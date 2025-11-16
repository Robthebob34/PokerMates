import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type RoomSummary = {
  id: string;
  name: string;
  code: string;
  maxPlayers: number;
  playerCount: number;
  smallBlind: number;
  bigBlind: number;
  buyInRange: {
    min: number;
    max: number;
  };
};

const MAX_PLAYER_OPTIONS = [2, 4, 6, 8, 9, 10];
const BLIND_PRESETS = [
  { label: '10 / 20', small: 10, big: 20 },
  { label: '25 / 50', small: 25, big: 50 },
  { label: '50 / 100', small: 50, big: 100 },
  { label: '100 / 200', small: 100, big: 200 },
];

const MIN_BUYIN_BB = 20;
const MAX_BUYIN_BB = 200;

const getBuyInLimits = (bigBlind: number) => ({
  min: bigBlind * MIN_BUYIN_BB,
  max: bigBlind * MAX_BUYIN_BB,
});

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const DEFAULT_SMALL_BLIND = 10;
const DEFAULT_BIG_BLIND = 20;
const DEFAULT_BUYIN = getBuyInLimits(DEFAULT_BIG_BLIND).min;

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [isFetchingRooms, setIsFetchingRooms] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    name: '',
    maxPlayers: 8,
    smallBlind: DEFAULT_SMALL_BLIND,
    bigBlind: DEFAULT_BIG_BLIND,
    buyIn: DEFAULT_BUYIN,
  });
  const [createStatus, setCreateStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [createMessage, setCreateMessage] = useState<string | null>(null);

  const joinPanelRef = useRef<HTMLDivElement | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinStatus, setJoinStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [joinBuyIn, setJoinBuyIn] = useState<number>(0);
  const [joiningRoom, setJoiningRoom] = useState<RoomSummary | null>(null);
  const [joinRoomError, setJoinRoomError] = useState<string | null>(null);
  const [isFetchingJoinRoom, setIsFetchingJoinRoom] = useState(false);

  const userChips = user?.chips ?? 0;
  const createBuyInLimits = useMemo(
    () => getBuyInLimits(createForm.bigBlind || DEFAULT_BIG_BLIND),
    [createForm.bigBlind]
  );
  const normalizedJoinCode = joinCode.trim().toUpperCase();
  const matchingRoomLimits = joiningRoom?.buyInRange;

  useEffect(() => {
    const controller = new AbortController();

    const loadRoomByCode = async () => {
      if (!normalizedJoinCode) {
        setJoiningRoom(null);
        setJoinRoomError(null);
        setJoinBuyIn(0);
        return;
      }

      setIsFetchingJoinRoom(true);
      setJoinRoomError(null);

      try {
        const response = await fetch(`${API_BASE_URL}/api/rooms/code/${normalizedJoinCode}`, {
          credentials: 'include',
          signal: controller.signal,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error((data as any).error ?? 'Unable to load room');
        }

        const data = (await response.json()) as { room: RoomSummary };
        setJoiningRoom(data.room);
        setJoinBuyIn((prev) => {
          if (!data.room.buyInRange) {
            return prev || 0;
          }
          const { min, max } = data.room.buyInRange;
          const base = prev || min;
          return clamp(base, min, max);
        });
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return;
        }
        setJoiningRoom(null);
        setJoinRoomError(err?.message ?? 'Unable to load room');
        setJoinBuyIn(0);
      } finally {
        setIsFetchingJoinRoom(false);
      }
    };

    void loadRoomByCode();

    return () => controller.abort();
  }, [normalizedJoinCode]);

  useEffect(() => {
    if (!joiningRoom || !matchingRoomLimits || joinBuyIn === 0) {
      return;
    }
    setJoinBuyIn((prev) => clamp(prev, matchingRoomLimits.min, matchingRoomLimits.max));
  }, [joiningRoom, matchingRoomLimits, joinBuyIn]);

  const createDisabled = useMemo(
    () =>
      !createForm.name.trim() ||
      createForm.smallBlind <= 0 ||
      createForm.bigBlind <= createForm.smallBlind ||
      createForm.buyIn < createBuyInLimits.min ||
      createForm.buyIn > createBuyInLimits.max ||
      createForm.buyIn > userChips ||
      createStatus === 'saving',
    [createForm, createStatus, createBuyInLimits, userChips]
  );

  const joinDisabled = useMemo(
    () =>
      !joinCode.trim() ||
      joinStatus === 'saving' ||
      !joiningRoom ||
      joinBuyIn <= 0 ||
      (!!matchingRoomLimits &&
        (joinBuyIn < matchingRoomLimits.min || joinBuyIn > matchingRoomLimits.max)) ||
      joinBuyIn > userChips,
    [joinCode, joinStatus, joiningRoom, joinBuyIn, matchingRoomLimits, userChips]
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const fetchRooms = async () => {
    try {
      setIsFetchingRooms(true);
      setRoomError(null);

      const response = await fetch(`${API_BASE_URL}/api/rooms`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load rooms');
      }

      const data = (await response.json()) as { rooms: RoomSummary[] };
      setRooms(data.rooms ?? []);
    } catch (error: any) {
      setRoomError(error?.message ?? 'Unable to fetch rooms');
    } finally {
      setIsFetchingRooms(false);
    }
  };

  useEffect(() => {
    void fetchRooms();
  }, []);

  const openRoomTab = (roomId: string) => {
    const tableUrl = `${window.location.origin}/table/${roomId}`;
    window.open(tableUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCreateRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (createDisabled) {
      return;
    }

    try {
      setCreateStatus('saving');
      setCreateMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: createForm.name.trim(),
          maxPlayers: createForm.maxPlayers,
          smallBlind: createForm.smallBlind,
          bigBlind: createForm.bigBlind,
          buyIn: createForm.buyIn,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as any).error ?? 'Failed to create room');
      }

      const data = await response.json();
      setCreateStatus('success');
      setCreateMessage(`Room created! Share code ${data.room.code}`);
      setCreateForm((prev) => ({ ...prev, name: '' }));
      await fetchRooms();
      openRoomTab(data.room.id);
    } catch (error: any) {
      setCreateStatus('error');
      setCreateMessage(error?.message ?? 'Unable to create room');
    } finally {
      setTimeout(() => setCreateStatus('idle'), 2000);
    }
  };

  const joinRoomApi = async (code: string, buyIn: number) => {
    const response = await fetch(`${API_BASE_URL}/api/rooms/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code, buyIn }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error((data as any).error ?? 'Failed to join room');
    }

    return response.json();
  };

  const scrollToJoinPanel = () => {
    joinPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSelectRoomForJoin = (room: RoomSummary) => {
    setJoinCode(room.code);
    setJoiningRoom(room);
    setJoinRoomError(null);
    setJoinBuyIn(room.buyInRange.min);
    scrollToJoinPanel();
  };

  const handleJoinRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (joinDisabled || !joiningRoom) {
      return;
    }

    try {
      setJoinStatus('saving');
      setJoinMessage(null);

      const data = await joinRoomApi(joinCode.trim().toUpperCase(), joinBuyIn);
      setJoinStatus('success');
      setJoinMessage(`Joined ${data.room.name}`);
      setJoinCode('');
      setJoinBuyIn(0);
      setJoiningRoom(null);
      await fetchRooms();
      openRoomTab(data.room.id);
    } catch (error: any) {
      setJoinStatus('error');
      setJoinMessage(error?.message ?? 'Unable to join room');
    } finally {
      setTimeout(() => setJoinStatus('idle'), 2000);
    }
  };

  const statusColor = (status: 'idle' | 'saving' | 'success' | 'error') => {
    switch (status) {
      case 'saving':
        return '#ECC94B';
      case 'success':
        return '#48BB78';
      case 'error':
        return '#F56565';
      default:
        return '#CBD5F5';
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1a202c 0%, #171923 100%)',
        color: 'white',
        padding: '3rem 1.5rem',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <div>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>PokerMates Lobby</h1>
            <p style={{ opacity: 0.8 }}>Welcome back, {user?.username}</p>
            <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>
              Bankroll: <strong>{userChips.toLocaleString()} chips</strong>
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '999px',
              border: 'none',
              backgroundColor: '#E53E3E',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Logout
          </button>
        </header>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          {/* Create Room Card */}
          <div style={{ background: '#2D3748', borderRadius: '1rem', padding: '1.5rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Create a Room</h2>
            <form
              onSubmit={handleCreateRoom}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span>Room Name</span>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Friday Night Poker"
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #4A5568',
                    background: '#1A202C',
                    color: 'white',
                  }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span>Max Players</span>
                <select
                  value={createForm.maxPlayers}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      maxPlayers: Number(event.target.value),
                    }))
                  }
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #4A5568',
                    background: '#1A202C',
                    color: 'white',
                  }}
                >
                  {MAX_PLAYER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option} players
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span>Blinds</span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {BLIND_PRESETS.map((preset) => {
                    const isActive =
                      createForm.smallBlind === preset.small &&
                      createForm.bigBlind === preset.big;
                    return (
                      <button
                        type="button"
                        key={preset.label}
                        onClick={() =>
                          setCreateForm((prev) => ({
                            ...prev,
                            smallBlind: preset.small,
                            bigBlind: preset.big,
                            buyIn: clamp(
                              getBuyInLimits(preset.big).min,
                              getBuyInLimits(preset.big).min,
                              getBuyInLimits(preset.big).max
                            ),
                          }))
                        }
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: '999px',
                          border: '1px solid #4A5568',
                          background: isActive ? '#38B2AC' : 'transparent',
                          color: isActive ? '#1A202C' : 'white',
                          cursor: 'pointer',
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <input
                    type="number"
                    min={1}
                    value={createForm.smallBlind}
                    onChange={(event) => {
                      const smallBlind = Number(event.target.value) || 0;
                      setCreateForm((prev) => ({
                        ...prev,
                        smallBlind,
                        bigBlind: Math.max(prev.bigBlind, (smallBlind || 1) * 2),
                      }));
                    }}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #4A5568',
                      background: '#1A202C',
                      color: 'white',
                    }}
                  />
                  <input
                    type="number"
                    min={createForm.smallBlind + 1}
                    value={createForm.bigBlind}
                    onChange={(event) => {
                      const bigBlind = Number(event.target.value) || 0;
                      setCreateForm((prev) => ({
                        ...prev,
                        bigBlind: Math.max(bigBlind, prev.smallBlind + 1),
                      }));
                    }}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #4A5568',
                      background: '#1A202C',
                      color: 'white',
                    }}
                  />
                </div>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <span>
                  Buy-in ({createForm.buyIn.toLocaleString()} chips)
                  <span style={{ fontSize: '0.85rem', marginLeft: '0.35rem', opacity: 0.8 }}>
                    ({MIN_BUYIN_BB}BB - {MAX_BUYIN_BB}BB)
                  </span>
                </span>
                <input
                  type="range"
                  min={createBuyInLimits.min}
                  max={createBuyInLimits.max}
                  step={createForm.bigBlind || DEFAULT_BIG_BLIND}
                  value={createForm.buyIn}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      buyIn: clamp(
                        Number(event.target.value),
                        createBuyInLimits.min,
                        createBuyInLimits.max
                      ),
                    }))
                  }
                />
                <input
                  type="number"
                  min={createBuyInLimits.min}
                  max={createBuyInLimits.max}
                  value={createForm.buyIn}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      buyIn: clamp(
                        Number(event.target.value),
                        createBuyInLimits.min,
                        createBuyInLimits.max
                      ),
                    }))
                  }
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #4A5568',
                    background: '#1A202C',
                    color: 'white',
                  }}
                />
                <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>
                  Min: {createBuyInLimits.min.toLocaleString()} • Max:{' '}
                  {createBuyInLimits.max.toLocaleString()} • You have {userChips.toLocaleString()}
                </p>
                {createForm.buyIn > userChips && (
                  <p style={{ color: '#F56565', fontSize: '0.85rem' }}>
                    Not enough chips to cover this buy-in.
                  </p>
                )}
              </label>

              <button
                type="submit"
                disabled={createDisabled}
                style={{
                  padding: '0.9rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  fontWeight: 600,
                  background: createDisabled ? '#4A5568' : '#38B2AC',
                  color: createDisabled ? '#A0AEC0' : '#1A202C',
                  cursor: createDisabled ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s ease',
                }}
              >
                {createStatus === 'saving' ? 'Creating...' : 'Create Room'}
              </button>
              {createMessage && (
                <p style={{ color: statusColor(createStatus), fontSize: '0.9rem' }}>
                  {createMessage}
                </p>
              )}
            </form>
          </div>

          {/* Join Room Card */}
          <div ref={joinPanelRef} style={{ background: '#2D3748', borderRadius: '1rem', padding: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <div>
                <h2 style={{ marginBottom: '0.2rem' }}>Join via Code</h2>
                <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>
                  Pick a room and choose your starting stack.
                </p>
              </div>
              {joiningRoom && (
                <div
                  style={{
                    border: '1px solid rgba(56,178,172,0.5)',
                    borderRadius: '999px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.85rem',
                    color: '#81E6D9',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  Selected: {joiningRoom.code}
                </div>
              )}
            </div>

            <form
              onSubmit={handleJoinRoom}
              style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}
            >
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span>Room Code</span>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="ABCD12"
                  style={{
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #4A5568',
                    background: '#1A202C',
                    color: 'white',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                  }}
                />
                {isFetchingJoinRoom && (
                  <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Loading room…</span>
                )}
                {joinRoomError && (
                  <span style={{ color: '#F56565', fontSize: '0.85rem' }}>{joinRoomError}</span>
                )}
              </label>

              {joiningRoom && matchingRoomLimits ? (
                <div
                  style={{
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    background: '#1F2738',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: '0.9rem', opacity: 0.75 }}>Joining</p>
                      <h3 style={{ margin: 0 }}>{joiningRoom.name}</h3>
                      <p
                        style={{
                          fontFamily: 'monospace',
                          opacity: 0.65,
                          letterSpacing: '0.25em',
                        }}
                      >
                        {joiningRoom.code}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.9rem', opacity: 0.7 }}>Blinds</p>
                      <strong>
                        {joiningRoom.smallBlind}/{joiningRoom.bigBlind}
                      </strong>
                    </div>
                  </div>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <span>
                      Buy-in
                      <span
                        style={{
                          marginLeft: '0.35rem',
                          fontSize: '0.85rem',
                          opacity: 0.75,
                        }}
                      >
                        ({MIN_BUYIN_BB}BB – {MAX_BUYIN_BB}BB)
                      </span>
                    </span>
                    <input
                      type="range"
                      min={matchingRoomLimits.min}
                      max={matchingRoomLimits.max}
                      step={joiningRoom.bigBlind}
                      value={joinBuyIn || matchingRoomLimits.min}
                      onChange={(event) =>
                        setJoinBuyIn(
                          clamp(
                            Number(event.target.value),
                            matchingRoomLimits.min,
                            matchingRoomLimits.max
                          )
                        )
                      }
                    />
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <input
                        type="number"
                        min={matchingRoomLimits.min}
                        max={matchingRoomLimits.max}
                        value={joinBuyIn || ''}
                        onChange={(event) =>
                          setJoinBuyIn(
                            clamp(
                              Number(event.target.value),
                              matchingRoomLimits.min,
                              matchingRoomLimits.max
                            )
                          )
                        }
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          borderRadius: '0.5rem',
                          border: '1px solid #4A5568',
                          background: '#1A202C',
                          color: 'white',
                        }}
                      />
                      <div
                        style={{
                          minWidth: '180px',
                          borderRadius: '0.5rem',
                          border: '1px dashed rgba(255,255,255,0.2)',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.85rem',
                          opacity: 0.85,
                        }}
                      >
                        <div>Min: {matchingRoomLimits.min.toLocaleString()}</div>
                        <div>Max: {matchingRoomLimits.max.toLocaleString()}</div>
                      </div>
                    </div>
                    <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>
                      You have {userChips.toLocaleString()} chips available.
                    </p>
                    {joinBuyIn > 0 && joinBuyIn > userChips && (
                      <p style={{ color: '#F56565', fontSize: '0.85rem' }}>
                        Not enough chips to join with this amount.
                      </p>
                    )}
                  </label>
                </div>
              ) : (
                <div
                  style={{
                    border: '1px dashed rgba(255,255,255,0.2)',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    textAlign: 'center',
                    opacity: 0.7,
                  }}
                >
                  Enter a room code or pick one from the list to configure your buy-in.
                </div>
              )}

              <button
                type="submit"
                disabled={joinDisabled}
                style={{
                  padding: '0.9rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  fontWeight: 600,
                  background: joinDisabled ? '#4A5568' : '#4299E1',
                  color: joinDisabled ? '#A0AEC0' : '#1A202C',
                  cursor: joinDisabled ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s ease',
                }}
              >
                {joinStatus === 'saving' ? 'Joining...' : 'Join Room'}
              </button>
              {joinMessage && (
                <p style={{ color: statusColor(joinStatus), fontSize: '0.9rem' }}>{joinMessage}</p>
              )}
            </form>
          </div>
        </section>

        <section style={{ background: '#2D3748', borderRadius: '1rem', padding: '1.5rem' }}>
          <header
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <h2>Open Rooms</h2>
            <button
              onClick={fetchRooms}
              disabled={isFetchingRooms}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '999px',
                border: '1px solid #4A5568',
                background: 'transparent',
                color: 'white',
                cursor: isFetchingRooms ? 'not-allowed' : 'pointer',
              }}
            >
              {isFetchingRooms ? 'Refreshing...' : 'Refresh'}
            </button>
          </header>
          {roomError && <p style={{ color: '#F56565', marginTop: '1rem' }}>{roomError}</p>}
          <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem' }}>
            {rooms.length === 0 && !roomError ? (
              <p style={{ opacity: 0.7 }}>No rooms available yet. Create one above!</p>
            ) : (
              rooms.map((room) => (
                <div
                  key={room.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    borderRadius: '0.75rem',
                    background: '#1A202C',
                  }}
                >
                  <div>
                    <h3 style={{ marginBottom: '0.25rem' }}>{room.name}</h3>
                    <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>
                      Code: <strong>{room.code}</strong> • {room.playerCount}/{room.maxPlayers} players
                    </p>
                    <p style={{ opacity: 0.8, fontSize: '0.9rem' }}>
                      Blinds: {room.smallBlind}/{room.bigBlind}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectRoomForJoin(room)}
                    style={{
                      padding: '0.6rem 1.25rem',
                      borderRadius: '999px',
                      border: 'none',
                      background: '#4299E1',
                      color: '#1A202C',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Use Code
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
