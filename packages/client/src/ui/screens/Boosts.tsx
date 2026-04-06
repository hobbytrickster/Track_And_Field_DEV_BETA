import React, { useEffect, useState } from 'react';
import { UserBoost } from '@track-stars/shared';
import { api } from '../../api/client';
import { BoostCard } from '../components/BoostCard';

interface Props {
  onBack: () => void;
}

export function Boosts({ onBack }: Props) {
  const [boosts, setBoosts] = useState<UserBoost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBoosts().then(data => {
      setBoosts(data);
      setLoading(false);
    });
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a2e, #2a0a1e)',
      padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={onBack} style={backBtnStyle}>Back</button>
        <h2 style={{ color: '#fff', margin: 0 }}>Big Impact Cards ({boosts.length})</h2>
      </div>

      <p style={{ color: '#888', marginBottom: 24, fontSize: 17 }}>
        Use these powerful boost cards during races to give your athletes an edge!
        Select up to 3 boosts before each race.
      </p>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Loading boosts...</div>
      ) : boosts.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>
          No boost cards yet! Buy packs in the Shop to earn boosts.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {boosts.map(b => (
            <BoostCard key={b.id} boost={b} />
          ))}
        </div>
      )}
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: '#333', color: '#fff', border: '1px solid #555',
  borderRadius: 10, padding: '12px 24px', cursor: 'pointer', fontSize: 18,
};
