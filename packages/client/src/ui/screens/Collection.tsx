import React, { useEffect, useState } from 'react';
import { UserAthlete } from '@track-stars/shared';
import { api } from '../../api/client';
import { AthleteCard } from '../components/AthleteCard';

interface Props {
  onBack: () => void;
  onCustomize?: (athleteId: string) => void;
}

export function Collection({ onBack, onCustomize }: Props) {
  const [athletes, setAthletes] = useState<UserAthlete[]>([]);
  const [selected, setSelected] = useState<UserAthlete | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    api.getAthletes().then(data => {
      setAthletes(data);
      setLoading(false);
    });
  }, []);

  const filtered = filter === 'all' ? athletes :
    athletes.filter(a => a.template?.specialtyEvent === filter);

  const sorted = [...filtered].sort((a, b) =>
    (b.template?.overallRating || 0) - (a.template?.overallRating || 0)
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a2e, #1a0a3e)',
      padding: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack} style={backBtnStyle}>Back</button>
          <h2 style={{ color: '#fff', margin: 0 }}>My Athletes ({athletes.length}/50)</h2>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all', '200m', '400m', '800m'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? '#FFD700' : '#333',
              color: filter === f ? '#000' : '#888',
              border: 'none', borderRadius: 10, padding: '10px 22px',
              cursor: 'pointer', fontWeight: 'bold', fontSize: 17,
            }}>{f.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Loading collection...</div>
      ) : athletes.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>
          No athletes yet! Visit the Shop to buy card packs.
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 20 }}>
          {/* Card grid */}
          <div style={{
            flex: 1, display: 'flex', flexWrap: 'wrap', gap: 12,
            alignContent: 'flex-start',
          }}>
            {sorted.map(a => (
              <AthleteCard
                key={a.id}
                athlete={a}
                selected={selected?.id === a.id}
                onClick={() => setSelected(a)}
                compact
              />
            ))}
          </div>

          {/* Detail panel */}
          {selected && (
            <div style={{
              width: 260, background: 'rgba(20,20,50,0.8)', borderRadius: 12,
              padding: 16, border: '1px solid #444',
            }}>
              <AthleteCard athlete={selected} />
              {onCustomize && (
                <button onClick={() => onCustomize(selected.id)} style={{
                  width: '100%', marginTop: 12, padding: '12px', fontSize: 16, fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #ff6688, #ff4466)', color: '#fff',
                  border: 'none', borderRadius: 10, cursor: 'pointer',
                }}>
                  Customize Look
                </button>
              )}
              <div style={{ marginTop: 8, textAlign: 'center', fontSize: 12, color: '#888' }}>
                {(selected as any).appearance ? 'Custom look applied' : 'Default look'}
              </div>
              <button onClick={async () => {
                const t = selected.template;
                const sellValues: Record<string, number> = { bronze: 25, silver: 50, gold: 100, platinum: 200, diamond: 500 };
                const value = sellValues[t?.rarity || 'bronze'] || 25;
                if (window.confirm(`Sell ${t?.name || 'this athlete'}? (${t?.rarity} ${t?.overallRating} OVR)\n\nYou'll receive ${value} coins.\nThis cannot be undone!`)) {
                  try {
                    const result = await api.releaseAthlete(selected.id);
                    setAthletes(prev => prev.filter(a => a.id !== selected.id));
                    setSelected(null);
                    alert(`Sold for ${result.coinsEarned} coins! New balance: ${result.newBalance}`);
                  } catch (err: any) { alert(err.message); }
                }
              }} style={{
                width: '100%', marginTop: 8, padding: '10px', fontSize: 14,
                background: '#442222', color: '#ff6666', border: '1px solid #663333',
                borderRadius: 8, cursor: 'pointer',
              }}>
                Sell Athlete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: '#333', color: '#fff', border: '1px solid #555',
  borderRadius: 10, padding: '12px 24px', cursor: 'pointer', fontSize: 18,
};
