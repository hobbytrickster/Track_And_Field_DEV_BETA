import React, { useState } from 'react';

const COUNTRIES = [
  'USA','Canada','Jamaica','Great Britain','Germany','France','Japan','Australia',
  'Brazil','Kenya','Ethiopia','South Africa','Nigeria','China','India','Mexico',
  'Italy','Spain','Netherlands','Sweden','Norway','Denmark','Finland','Poland',
  'Russia','Ukraine','Turkey','South Korea','New Zealand','Ireland','Belgium',
  'Switzerland','Austria','Portugal','Czech Republic','Greece','Hungary','Romania',
  'Colombia','Argentina','Chile','Peru','Cuba','Trinidad & Tobago','Bahamas',
  'Dominican Republic','Puerto Rico','Venezuela','Ecuador','Costa Rica','Panama',
  'Morocco','Algeria','Egypt','Ghana','Cameroon','Ivory Coast','Tanzania',
  'Uganda','Botswana','Namibia','Senegal','Thailand','Philippines','Indonesia',
  'Malaysia','Vietnam','Singapore','Taiwan','Hong Kong','Israel','Saudi Arabia',
  'Qatar','Bahrain','UAE','Croatia','Serbia','Slovenia','Slovakia','Bulgaria',
  'Lithuania','Latvia','Estonia','Iceland','Luxembourg','Malta',
];

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string, displayName: string) => Promise<void>;
}

export function Login({ onLogin, onRegister }: Props) {
  const [isRegister, setIsRegister] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('USA');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        // Store displayName as "TeamName (Country)"
        const displayName = `${teamName} (${country})`;
        await onRegister(teamName, password, displayName);
      } else {
        await onLogin(teamName, password);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(180deg, #1a0a0a, #0d0d0d, #1a0a0a)',
    }}>
      <div style={{
        background: 'rgba(20,10,10,0.95)', border: '2px solid #cc2244', borderRadius: 16,
        padding: 50, width: 500, boxShadow: '0 0 40px rgba(204,34,68,0.2)',
      }}>
        <h1 style={{
          textAlign: 'center', fontSize: 52, fontWeight: 'bold', marginBottom: 10,
          background: 'linear-gradient(135deg, #cc2244, #ff4466)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          WIN BIG: TRACK & FIELD
        </h1>
        <p style={{ textAlign: 'center', color: '#888', marginBottom: 36, fontSize: 18 }}>
          Collect. Train. Race. Win.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text" placeholder="Team Name" value={teamName}
            onChange={e => setTeamName(e.target.value)} required
            style={inputStyle}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} required minLength={4}
            style={inputStyle}
          />
          {error && <div style={{ color: '#ff4444', fontSize: 15, marginBottom: 12, textAlign: 'center' }}>{error}</div>}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '16px', fontSize: 20, fontWeight: 'bold',
            background: 'linear-gradient(135deg, #cc2244, #991133)', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', marginBottom: 12,
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Please wait...' : 'LOGIN'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '14px 18px', fontSize: 18, marginBottom: 16,
  background: '#1a1010', border: '1px solid #444', borderRadius: 10, color: '#fff',
  outline: 'none',
};
