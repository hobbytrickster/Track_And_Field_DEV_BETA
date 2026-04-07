import React, { useState } from 'react';
import { api } from '../../api/client';
import { PackContents } from '@track-stars/shared';

interface Props {
  coins: number;
  onCoinsUpdate: (coins: number) => void;
  onBack: () => void;
}

const PACKS = [
  {
    type: 'bronze' as const, name: 'Bronze Pack', cost: 200,
    athletes: 3, boosts: 2, color: '#CD7F32',
    description: 'A basic pack. Mostly bronze athletes with a chance at silver.',
    athleteOdds: [
      { rarity: 'Bronze', pct: '70%', color: '#CD7F32' },
      { rarity: 'Silver', pct: '25%', color: '#C0C0C0' },
      { rarity: 'Gold', pct: '5%', color: '#FFD700' },
    ],
    boostOdds: [
      { rarity: 'Bronze', pct: '80%', color: '#CD7F32' },
      { rarity: 'Silver', pct: '20%', color: '#C0C0C0' },
    ],
  },
  {
    type: 'silver' as const, name: 'Silver Pack', cost: 400,
    athletes: 3, boosts: 3, color: '#C0C0C0',
    description: 'Better odds! Silver and gold athletes with rare boosts.',
    athleteOdds: [
      { rarity: 'Silver', pct: '40%', color: '#C0C0C0' },
      { rarity: 'Gold', pct: '40%', color: '#FFD700' },
      { rarity: 'Platinum', pct: '18%', color: '#E5E4E2' },
      { rarity: 'Diamond', pct: '2%', color: '#B9F2FF' },
    ],
    boostOdds: [
      { rarity: 'Bronze', pct: '20%', color: '#CD7F32' },
      { rarity: 'Silver', pct: '50%', color: '#C0C0C0' },
      { rarity: 'Gold', pct: '25%', color: '#FFD700' },
      { rarity: 'Platinum', pct: '5%', color: '#E5E4E2' },
    ],
  },
  {
    type: 'gold' as const, name: 'Gold Pack', cost: 1000,
    athletes: 1, boosts: 3, color: '#FFD700',
    description: 'Premium! One guaranteed gold or better athlete. Top-tier boosts.',
    athleteOdds: [
      { rarity: 'Gold', pct: '29.6%', color: '#FFD700' },
      { rarity: 'Platinum', pct: '45%', color: '#E5E4E2' },
      { rarity: 'Diamond', pct: '25%', color: '#B9F2FF' },
      { rarity: 'SUPER STAR', pct: '0.4%', color: '#aa44ff' },
    ],
    boostOdds: [
      { rarity: 'Silver', pct: '15%', color: '#C0C0C0' },
      { rarity: 'Gold', pct: '45%', color: '#FFD700' },
      { rarity: 'Platinum', pct: '30%', color: '#E5E4E2' },
      { rarity: 'Diamond', pct: '10%', color: '#B9F2FF' },
    ],
  },
  {
    type: 'boost' as const, name: 'Boost Pack', cost: 300,
    athletes: 0, boosts: 5, color: '#ff8800',
    description: '5 Big Impact cards. No athletes — pure boost power.',
    athleteOdds: [],
    boostOdds: [
      { rarity: 'Bronze', pct: '15%', color: '#CD7F32' },
      { rarity: 'Silver', pct: '35%', color: '#C0C0C0' },
      { rarity: 'Gold', pct: '30%', color: '#FFD700' },
      { rarity: 'Platinum', pct: '15%', color: '#E5E4E2' },
      { rarity: 'Diamond', pct: '5%', color: '#B9F2FF' },
    ],
  },
  {
    type: 'super' as const, name: 'Super Pack', cost: 15000,
    athletes: 1, boosts: 5, color: '#aa44ff',
    description: 'GUARANTEED Super Star athlete! The absolute best in the game.',
    athleteOdds: [
      { rarity: 'SUPER STAR', pct: '100%', color: '#aa44ff' },
    ],
    boostOdds: [
      { rarity: 'Gold', pct: '20%', color: '#FFD700' },
      { rarity: 'Platinum', pct: '40%', color: '#E5E4E2' },
      { rarity: 'Diamond', pct: '40%', color: '#B9F2FF' },
    ],
  },
];

export function Shop({ coins, onCoinsUpdate, onBack }: Props) {
  const [opening, setOpening] = useState(false);
  const [packResult, setPackResult] = useState<PackContents | null>(null);
  const [error, setError] = useState('');
  const [expandedOdds, setExpandedOdds] = useState<string | null>(null);

  // Inject shimmer animation for super pack
  React.useEffect(() => {
    if (document.getElementById('shop-shimmer')) return;
    const style = document.createElement('style');
    style.id = 'shop-shimmer';
    style.textContent = `
      @keyframes superShimmer {
        0% { background-position: 100% 50%; }
        50% { background-position: 0% 50%; }
        100% { background-position: 100% 50%; }
      }
      @keyframes superTextGlow {
        0% { text-shadow: 0 0 8px #aa44ff, 0 0 16px #6600aa; }
        50% { text-shadow: 0 0 16px #cc66ff, 0 0 30px #aa44ff, 0 0 40px #ff88ff; }
        100% { text-shadow: 0 0 8px #aa44ff, 0 0 16px #6600aa; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  const buyPack = async (packType: string) => {
    const pack = PACKS.find(p => p.type === packType);
    if (!pack) return;
    if (!window.confirm(`Buy ${pack.name} for ${pack.cost} coins?\n\nYou'll receive ${pack.athletes > 0 ? `${pack.athletes} athlete(s) and ` : ''}${pack.boosts} boost(s).`)) return;

    setError('');
    setOpening(true);
    try {
      const result = await api.buyPack(packType);
      setPackResult(result.contents);
      onCoinsUpdate(result.remainingCoins);
    } catch (err: any) {
      setError(err.message);
    }
    setOpening(false);
  };

  const toggleOdds = (type: string) => {
    setExpandedOdds(expandedOdds === type ? null : type);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #1a0a0a, #0d0d0d)',
      padding: 20,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack} style={backBtnStyle}>Back</button>
          <h2 style={{ color: '#fff', margin: 0, fontSize: 24 }}>Card Shop</h2>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #cc2244, #991133)',
          padding: '10px 22px', borderRadius: 20, fontWeight: 'bold', color: '#fff', fontSize: 20,
        }}>
          {coins} coins
        </div>
      </div>

      {error && <div style={{ color: '#ff4444', textAlign: 'center', marginBottom: 16, fontSize: 16 }}>{error}</div>}

      {/* Pack display */}
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        {PACKS.map(pack => {
          const isSuper = pack.type === 'super';
          return <div key={pack.type} style={{
            background: isSuper
              ? 'linear-gradient(135deg, #1a0033, #330066, #1a0033)'
              : `linear-gradient(180deg, ${pack.color}18, ${pack.color}08)`,
            border: isSuper ? '2px solid #aa44ff' : `2px solid ${pack.color}55`,
            borderRadius: 16, padding: 24, width: 260, textAlign: 'center',
            boxShadow: isSuper ? '0 0 20px rgba(170,68,255,0.3)' : 'none',
          }}>
            <div style={{
              width: 100, height: 130, margin: '0 auto 14px',
              background: isSuper
                ? 'linear-gradient(90deg, #6600aa 0%, #8833cc 20%, #cc77ff 40%, #dd99ff 50%, #cc77ff 60%, #8833cc 80%, #6600aa 100%)'
                : `linear-gradient(135deg, ${pack.color}44, ${pack.color}22)`,
              backgroundSize: isSuper ? '300% 100%' : undefined,
              animation: isSuper ? 'superShimmer 6s ease-in-out infinite' : undefined,
              borderRadius: 12, border: `3px solid ${isSuper ? '#cc66ff' : pack.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 42,
              boxShadow: isSuper ? '0 0 15px rgba(170,68,255,0.5)' : 'none',
            }}>
              {isSuper ? '🔥' : pack.type === 'boost' ? '⚡' : pack.type === 'bronze' ? '🥉' : pack.type === 'silver' ? '🥈' : '🥇'}
            </div>

            <h3 style={{
              color: pack.color, fontSize: 22, margin: '0 0 6px',
              ...(isSuper ? {
                textShadow: '0 0 10px #aa44ff, 0 0 20px #cc66ff',
                animation: 'superTextGlow 2s ease-in-out infinite',
              } : {}),
            }}>{pack.name}</h3>
            <p style={{ color: '#888', fontSize: 14, marginBottom: 10, lineHeight: 1.4 }}>{pack.description}</p>

            <div style={{ color: '#aaa', fontSize: 13, marginBottom: 10 }}>
              {pack.athletes > 0 ? `${pack.athletes} Athlete(s) + ` : ''}{pack.boosts} Boost(s)
            </div>

            {/* Expandable odds */}
            <button onClick={() => toggleOdds(pack.type)} style={{
              background: 'none', border: '1px solid #444', borderRadius: 6,
              color: '#aaa', fontSize: 12, padding: '4px 12px', cursor: 'pointer',
              marginBottom: 10, width: '100%',
            }}>
              {expandedOdds === pack.type ? '▲ Hide Odds' : '▼ View Odds'}
            </button>

            {expandedOdds === pack.type && (
              <div style={{ background: '#0a0a0a', borderRadius: 8, padding: 10, marginBottom: 10, textAlign: 'left' }}>
                {pack.athleteOdds.length > 0 && (
                  <>
                    <div style={{ color: '#888', fontSize: 11, marginBottom: 4, fontWeight: 'bold' }}>ATHLETE ODDS</div>
                    {pack.athleteOdds.map(o => (
                      <div key={o.rarity} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
                        <span style={{ color: o.color, fontWeight: 'bold' }}>{o.rarity}</span>
                        <span style={{ color: '#ccc' }}>{o.pct}</span>
                      </div>
                    ))}
                  </>
                )}
                {pack.boostOdds.length > 0 && (
                  <>
                    <div style={{ color: '#888', fontSize: 11, marginBottom: 4, marginTop: pack.athleteOdds.length > 0 ? 8 : 0, fontWeight: 'bold' }}>BOOST ODDS</div>
                    {pack.boostOdds.map(o => (
                      <div key={o.rarity} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
                        <span style={{ color: o.color, fontWeight: 'bold' }}>{o.rarity}</span>
                        <span style={{ color: '#ccc' }}>{o.pct}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            <button
              onClick={() => buyPack(pack.type)}
              disabled={coins < pack.cost || opening}
              style={{
                width: '100%', padding: '12px', fontSize: 18, fontWeight: 'bold',
                background: coins >= pack.cost ? `linear-gradient(135deg, ${pack.color}, ${pack.color}cc)` : '#333',
                color: coins >= pack.cost ? '#000' : '#666',
                border: 'none', borderRadius: 8, cursor: coins >= pack.cost ? 'pointer' : 'not-allowed',
              }}
            >
              {opening ? 'Opening...' : `${pack.cost} coins`}
            </button>
          </div>
        })}
      </div>

      {/* Pack opening results */}
      {packResult && (
        <div style={{
          background: 'rgba(20,10,10,0.95)', border: '2px solid #cc2244', borderRadius: 16,
          padding: 24, maxWidth: 800, margin: '0 auto',
        }}>
          <h3 style={{ color: '#cc2244', textAlign: 'center', marginBottom: 16, fontSize: 22 }}>Pack Opened!</h3>

          {packResult.athletes.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ color: '#fff', marginBottom: 8, fontSize: 16 }}>Athletes:</h4>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {packResult.athletes.map((a, i) => (
                  <PackCard key={i} name={a.name} rarity={a.rarity} rating={a.overallRating}
                    sub={`${a.specialtyEvent} | ${a.nationality}`}
                    color={RARITY_COLORS[a.rarity] || '#fff'} />
                ))}
              </div>
            </div>
          )}

          {packResult.boosts.length > 0 && (
            <div>
              <h4 style={{ color: '#fff', marginBottom: 8, fontSize: 16 }}>Boost Cards:</h4>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {packResult.boosts.map((b, i) => (
                  <PackCard key={i} name={b.name} rarity={b.rarity} rating={Math.round(b.effectMagnitude * 100)}
                    sub={b.effectType.replace(/_/g, ' ')}
                    color={b.color} isBoost />
                ))}
              </div>
            </div>
          )}

          <button onClick={() => setPackResult(null)} style={{
            display: 'block', margin: '16px auto 0', padding: '10px 30px',
            background: '#cc2244', color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 16, fontWeight: 'bold', cursor: 'pointer',
          }}>OK</button>
        </div>
      )}
    </div>
  );
}

const RARITY_COLORS: Record<string, string> = {
  bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700', platinum: '#E5E4E2', diamond: '#B9F2FF',
};

function PackCard({ name, rarity, rating, sub, color, isBoost }: {
  name: string; rarity: string; rating: number; sub: string; color: string; isBoost?: boolean;
}) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}33, ${color}11)`,
      border: `2px solid ${color}`, borderRadius: 10, padding: 12, width: 150, textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color, textTransform: 'uppercase', fontWeight: 'bold' }}>{rarity}</div>
      <div style={{ fontSize: isBoost ? 20 : 30, fontWeight: 'bold', color: '#fff' }}>
        {isBoost ? `+${rating}%` : rating}
      </div>
      <div style={{ fontSize: 13, fontWeight: 'bold', color: '#fff', marginBottom: 2 }}>{name}</div>
      <div style={{ fontSize: 11, color: '#aaa' }}>{sub}</div>
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: '#333', color: '#fff', border: '1px solid #555',
  borderRadius: 10, padding: '12px 24px', cursor: 'pointer', fontSize: 18,
};
