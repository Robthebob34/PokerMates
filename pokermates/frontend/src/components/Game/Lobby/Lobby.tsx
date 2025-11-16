import { useState } from 'react';
import { useGame } from '../../../contexts/GameContext';

export const Lobby = () => {
  const { playerName, setPlayerName, joinRoom, createRoom } = useGame();
  const [roomCode, setRoomCode] = useState('');

  return (
    <div style={{ 
      maxWidth: '600px', 
      margin: '0 auto', 
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', textAlign: 'center' }}>PokerMates</h1>
      
      <div style={{ width: '100%' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Your Name</label>
        <input
          type="text"
          placeholder="Enter your name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            marginBottom: '1rem',
            borderRadius: '0.25rem',
            border: '1px solid #4A5568',
            backgroundColor: '#2D3748',
            color: 'white'
          }}
        />
      </div>

      <button
        onClick={createRoom}
        disabled={!playerName.trim()}
        style={{
          backgroundColor: '#38B2AC',
          color: 'white',
          padding: '0.75rem',
          borderRadius: '0.25rem',
          border: 'none',
          width: '100%',
          marginBottom: '1rem',
          fontSize: '1rem',
          opacity: !playerName.trim() ? 0.5 : 1,
          cursor: !playerName.trim() ? 'not-allowed' : 'pointer'
        }}
      >
        Create New Game
      </button>

      <div style={{ textAlign: 'center', margin: '1rem 0' }}>
        <span>OR</span>
      </div>

      <div style={{ width: '100%' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Join Existing Game</label>
        <input
          type="text"
          placeholder="Enter room code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          style={{
            width: '100%',
            padding: '0.5rem',
            marginBottom: '1rem',
            borderRadius: '0.25rem',
            border: '1px solid #4A5568',
            backgroundColor: '#2D3748',
            color: 'white'
          }}
        />
        <button
          onClick={() => joinRoom(roomCode)}
          disabled={!playerName.trim() || !roomCode.trim()}
          style={{
            backgroundColor: '#4299E1',
            color: 'white',
            padding: '0.75rem',
            borderRadius: '0.25rem',
            border: 'none',
            width: '100%',
            fontSize: '1rem',
            opacity: (!playerName.trim() || !roomCode.trim()) ? 0.5 : 1,
            cursor: (!playerName.trim() || !roomCode.trim()) ? 'not-allowed' : 'pointer'
          }}
        >
          Join Game
        </button>
      </div>
    </div>
  );
};
