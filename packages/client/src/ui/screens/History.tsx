import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatRaceTime } from '../../phaser/utils/trackGeometry';

interface RaceRecord {
  raceId: string;
  eventType: string;
  finishPosition: number;
  finishTimeMs: number;
  lane: number;
  createdAt: string;
}

interface Props {
  onBack: () => void;
}

export function History({ onBack }: Props) {
  const [races, setRaces] = useState<RaceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getRaceHistory().then(data => {
      setRaces(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a2e, #1a0a3e)',
      padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={onBack} style={backBtnStyle}>Back</button>
        <h2 style={{ color: '#fff', margin: 0 }}>Race History</h2>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Loading...</div>
      ) : races.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>No races yet!</div>
      ) : (
        <div style={{ maxWidth: 850 }}>
          {races.map(r => (
            <div key={r.raceId} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px', marginBottom: 10,
              background: r.finishPosition === 1 ? 'rgba(255,215,0,0.1)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${r.finishPosition === 1 ? '#FFD700' : '#333'}`,
              borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: r.finishPosition === 1 ? '#FFD700' : r.finishPosition <= 3 ? '#666' : '#333',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: r.finishPosition === 1 ? '#000' : '#fff',
                  fontWeight: 'bold', fontSize: 20,
                }}>
                  {r.finishPosition}
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>{r.eventType}</div>
                  <div style={{ color: '#888', fontSize: 14 }}>{r.createdAt}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#FFD700', fontWeight: 'bold', fontSize: 18 }}>
                  {formatRaceTime(r.finishTimeMs)}
                </div>
                <div style={{ color: '#888', fontSize: 14 }}>Lane {r.lane}</div>
              </div>
            </div>
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
