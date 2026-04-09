import React, { useEffect, useState } from 'react';
import { UserBoost } from '@track-stars/shared';
import { api } from '../../api/client';
import { BoostCard } from '../components/BoostCard';

interface Props {
  onBack: () => void;
}

type Tab = 'impacts' | 'gear';

export function Boosts({ onBack }: Props) {
  const [boosts, setBoosts] = useState<UserBoost[]>([]);
  const [perfBoosts, setPerfBoosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('impacts');

  useEffect(() => {
    Promise.all([api.getBoosts(), api.getPerfBoosts()]).then(([b, pb]) => {
      setBoosts(b);
      setPerfBoosts(pb);
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
        <h2 style={{ color: '#fff', margin: 0 }}>Inventory</h2>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab('impacts')} style={{
          padding: '12px 28px', fontSize: 16, fontWeight: 'bold', borderRadius: 10, cursor: 'pointer',
          background: tab === 'impacts' ? 'linear-gradient(135deg, #ff8800, #cc6600)' : '#222',
          color: tab === 'impacts' ? '#fff' : '#888',
          border: tab === 'impacts' ? '2px solid #ffaa33' : '1px solid #444',
        }}>
          BIG IMPACT CARDS ({boosts.length})
        </button>
        <button onClick={() => setTab('gear')} style={{
          padding: '12px 28px', fontSize: 16, fontWeight: 'bold', borderRadius: 10, cursor: 'pointer',
          background: tab === 'gear' ? 'linear-gradient(135deg, #00cc66, #008844)' : '#222',
          color: tab === 'gear' ? '#fff' : '#888',
          border: tab === 'gear' ? '2px solid #00ff88' : '1px solid #444',
        }}>
          GEAR ({perfBoosts.filter(b => b.quantity > 0).length})
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Loading...</div>
      ) : tab === 'impacts' ? (
        <>
          <p style={{ color: '#888', marginBottom: 16, fontSize: 15 }}>
            Use Big Impact cards during races to give your athletes an edge! Select one before each race.
          </p>
          {boosts.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>
              No Big Impact cards yet! Buy packs in the Shop.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {boosts.map(b => (
                <BoostCard key={b.id} boost={b} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <p style={{ color: '#888', marginBottom: 16, fontSize: 15 }}>
            Apply gear to your athletes for permanent stat boosts. Each athlete can equip up to 3 gear items. Gear cannot be removed once applied!
          </p>
          {perfBoosts.filter(b => b.quantity > 0).length === 0 ? (
            <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>
              No gear yet! Buy packs in the Shop to find gear.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {perfBoosts.filter(b => b.quantity > 0).map((b: any) => (
                <div key={b.id} style={{
                  background: `linear-gradient(135deg, ${b.template.color}33, ${b.template.color}11)`,
                  border: `2px solid ${b.template.color}`,
                  borderRadius: 14, padding: 16, width: 180, textAlign: 'center',
                }}>
                  <div style={{ fontSize: 36 }}>{b.template.iconKey}</div>
                  <div style={{ fontSize: 15, fontWeight: 'bold', color: b.template.color, marginTop: 4 }}>
                    {b.template.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{b.template.description}</div>
                  <div style={{ fontSize: 13, color: '#00ff88', fontWeight: 'bold', marginTop: 6 }}>
                    +{b.template.statBoosts.speed} SPD &nbsp; +{b.template.statBoosts.stamina} STA
                  </div>
                  <div style={{ fontSize: 13, color: '#00ff88', fontWeight: 'bold' }}>
                    +{b.template.statBoosts.acceleration} ACC &nbsp; +{b.template.statBoosts.form} FRM
                  </div>
                  <div style={{
                    marginTop: 6, fontSize: 12, color: '#888',
                    textTransform: 'uppercase', letterSpacing: 1,
                  }}>
                    {b.template.rarity}
                  </div>
                  <div style={{
                    marginTop: 4, fontSize: 14, fontWeight: 'bold',
                    color: '#fff', background: 'rgba(0,0,0,0.3)',
                    borderRadius: 6, padding: '2px 8px', display: 'inline-block',
                  }}>
                    x{b.quantity}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: '#333', color: '#fff', border: '1px solid #555',
  borderRadius: 10, padding: '12px 24px', cursor: 'pointer', fontSize: 18,
};
