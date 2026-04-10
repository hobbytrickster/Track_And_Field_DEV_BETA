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
    athletes: 1, boosts: 5, color: '#ff8800',
    description: 'The ultimate pack! Chance at LEGEND and Super Star athletes.',
    athleteOdds: [
      { rarity: 'LEGEND', pct: '10%', color: '#ff8800' },
      { rarity: 'SUPER STAR', pct: '69%', color: '#aa44ff' },
      { rarity: 'Diamond', pct: '10%', color: '#B9F2FF' },
      { rarity: 'Gold', pct: '0.5%', color: '#FFD700' },
      { rarity: 'Bronze', pct: '0.5%', color: '#CD7F32' },
    ],
    boostOdds: [
      { rarity: 'Gold', pct: '20%', color: '#FFD700' },
      { rarity: 'Platinum', pct: '40%', color: '#E5E4E2' },
      { rarity: 'Diamond', pct: '40%', color: '#B9F2FF' },
    ],
  },
  {
    type: 'gear_basic' as const, name: 'Gear Pack', cost: 350,
    athletes: 0, boosts: 0, color: '#00cc66',
    description: '3 gear items. Mostly bronze and silver with a chance at gold.',
    athleteOdds: [],
    boostOdds: [],
    gearOdds: [
      { rarity: 'Bronze', pct: '50%', color: '#CD7F32' },
      { rarity: 'Silver', pct: '35%', color: '#C0C0C0' },
      { rarity: 'Gold', pct: '15%', color: '#FFD700' },
    ],
  },
  {
    type: 'gear_pro' as const, name: 'Pro Gear Pack', cost: 1200,
    athletes: 0, boosts: 0, color: '#00aacc',
    description: '3 gear items. Gold and platinum focused with diamond chance.',
    athleteOdds: [],
    boostOdds: [],
    gearOdds: [
      { rarity: 'Silver', pct: '15%', color: '#C0C0C0' },
      { rarity: 'Gold', pct: '40%', color: '#FFD700' },
      { rarity: 'Platinum', pct: '30%', color: '#E5E4E2' },
      { rarity: 'Diamond', pct: '15%', color: '#B9F2FF' },
    ],
  },
  {
    type: 'gear_elite' as const, name: 'Elite Gear Pack', cost: 8000,
    athletes: 0, boosts: 0, color: '#ff4488',
    description: '2 premium gear items. High chance at diamond, superstar, and legend gear!',
    athleteOdds: [],
    boostOdds: [],
    gearOdds: [
      { rarity: 'Gold', pct: '5%', color: '#FFD700' },
      { rarity: 'Platinum', pct: '20%', color: '#E5E4E2' },
      { rarity: 'Diamond', pct: '40%', color: '#B9F2FF' },
      { rarity: 'SUPER STAR', pct: '25%', color: '#aa44ff' },
      { rarity: 'LEGEND', pct: '10%', color: '#ff8800' },
    ],
  },
];

export function Shop({ coins, onCoinsUpdate, onBack }: Props) {
  const [opening, setOpening] = useState(false);
  const [packResult, setPackResult] = useState<PackContents | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealPhase, setRevealPhase] = useState(0); // 0=none, 1=flash, 2=burst, 3=show
  const [revealColor, setRevealColor] = useState('#FFD700');
  const [error, setError] = useState('');
  const [expandedOdds, setExpandedOdds] = useState<string | null>(null);

  // Inject animations
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
      @keyframes packFlash {
        0% { opacity: 0; transform: scale(0.5); }
        30% { opacity: 1; transform: scale(1.2); }
        60% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(2); }
      }
      @keyframes packBurst {
        0% { opacity: 0; transform: scale(0.3) rotate(0deg); }
        50% { opacity: 1; transform: scale(1.1) rotate(180deg); }
        100% { opacity: 0; transform: scale(1.8) rotate(360deg); }
      }
      @keyframes revealFadeIn {
        0% { opacity: 0; transform: translateY(30px) scale(0.9); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes sparkle {
        0%, 100% { opacity: 0; transform: scale(0); }
        50% { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }, []);

  const buyPack = async (packType: string) => {
    const pack = PACKS.find(p => p.type === packType);
    if (!pack) return;
    const gearCount = ({ gear_basic: 3, gear_pro: 3, gear_elite: 2 } as any)[pack.type] || 0;
    const desc = gearCount > 0 ? `${gearCount} gear item(s)` : `${pack.athletes > 0 ? `${pack.athletes} athlete(s), ` : ''}${pack.boosts} boost(s)`;
    if (!window.confirm(`Buy ${pack.name} for ${pack.cost} coins?\n\nYou'll receive ${desc}.`)) return;

    setError('');
    setOpening(true);
    try {
      const result = await api.buyPack(packType);
      onCoinsUpdate(result.remainingCoins);

      // Whoosh sound effect
      try {
        const actx = new AudioContext();
        const dur = 0.5;
        const buf = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          const t = i / actx.sampleRate;
          const freq = 200 + t * 2000; // rising frequency sweep
          const env = Math.max(0, 1 - t / dur) * (1 - Math.pow(t / dur, 0.5)); // fast attack, slow decay
          data[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.15 + (Math.random() - 0.5) * env * 0.2;
        }
        const src = actx.createBufferSource();
        src.buffer = buf;
        src.connect(actx.destination);
        src.start();
        setTimeout(() => actx.close(), 1000);
      } catch {}

      // Grand reveal animation
      setRevealColor(pack.color);
      setRevealing(true);
      setRevealPhase(1); // flash
      await new Promise(r => setTimeout(r, 600));
      setRevealPhase(2); // burst
      await new Promise(r => setTimeout(r, 800));
      setRevealPhase(3); // show results
      await new Promise(r => setTimeout(r, 300));
      setRevealing(false);
      setRevealPhase(0);
      setPackResult(result.contents);
    } catch (err: any) {
      setError(err.message);
      setRevealing(false);
      setRevealPhase(0);
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

      {/* Player packs */}
      <h2 style={{ color: '#FFD700', textAlign: 'center', marginBottom: 16, fontSize: 36, fontWeight: 'bold', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>Player Packs</h2>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        {PACKS.filter(p => !p.type.startsWith('gear_') && p.type !== 'boost').map(pack => {
          const isSuper = pack.type === 'super';
          return <div key={pack.type} style={{
            background: isSuper
              ? 'linear-gradient(135deg, #1a0033, #330066, #1a0033)'
              : `linear-gradient(180deg, ${pack.color}33, ${pack.color}15)`,
            border: isSuper ? '3px solid #aa44ff' : `3px solid ${pack.color}88`,
            borderRadius: 16, padding: 28, width: 300, textAlign: 'center',
            boxShadow: isSuper ? '0 0 20px rgba(170,68,255,0.3)' : 'none',
          }}>
            <div style={{
              width: 130, height: 170, margin: '0 auto 16px',
              background: isSuper
                ? 'linear-gradient(90deg, #6600aa 0%, #8833cc 20%, #cc77ff 40%, #dd99ff 50%, #cc77ff 60%, #8833cc 80%, #6600aa 100%)'
                : `linear-gradient(135deg, ${pack.color}88, ${pack.color}44)`,
              backgroundSize: isSuper ? '300% 100%' : undefined,
              animation: isSuper ? 'superShimmer 10s ease-in-out infinite' : undefined,
              borderRadius: 12, border: `3px solid ${isSuper ? '#cc66ff' : pack.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 42,
              boxShadow: isSuper ? '0 0 15px rgba(170,68,255,0.5)' : 'none',
            }}>
              {isSuper ? '🔥' : pack.type === 'boost' ? '⚡' : pack.type === 'bronze' ? '🥉' : pack.type === 'silver' ? '🥈' : '🥇'}
            </div>

            <h3 style={{
              color: pack.color, fontSize: 26, margin: '0 0 8px',
              ...(isSuper ? {
                textShadow: '0 0 10px #aa44ff, 0 0 20px #cc66ff',
                animation: 'superTextGlow 2s ease-in-out infinite',
              } : {}),
            }}>{pack.name}</h3>
            <p style={{ color: '#888', fontSize: 15, marginBottom: 12, lineHeight: 1.4 }}>{pack.description}</p>

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
                {(pack as any).gearOdds?.length > 0 && (
                  <>
                    <div style={{ color: '#00ff88', fontSize: 11, marginBottom: 4, marginTop: 8, fontWeight: 'bold' }}>GEAR ODDS</div>
                    {(pack as any).gearOdds.map((o: any) => (
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
                width: '100%', padding: '14px', fontSize: 20, fontWeight: 'bold',
                background: coins >= pack.cost ? `linear-gradient(135deg, ${pack.color}, ${pack.color}cc)` : '#333',
                color: coins >= pack.cost ? '#000' : '#666',
                border: 'none', borderRadius: 10, cursor: coins >= pack.cost ? 'pointer' : 'not-allowed',
              }}
            >
              {opening ? 'Opening...' : `${pack.cost} coins`}
            </button>
          </div>
        })}
      </div>

      {/* Gear packs */}
      <h2 style={{ color: '#00ff88', textAlign: 'center', marginBottom: 16, fontSize: 36, fontWeight: 'bold', textShadow: '0 0 10px rgba(0,255,136,0.3)' }}>Boost & Gear Packs</h2>
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        {PACKS.filter(p => p.type.startsWith('gear_') || p.type === 'boost').map(pack => {
          const isGear = true;
          return <div key={pack.type} style={{
            background: `linear-gradient(180deg, ${pack.color}33, ${pack.color}15)`,
            border: `3px solid ${pack.color}88`,
            borderRadius: 16, padding: 28, width: 300, textAlign: 'center',
          }}>
            <div style={{
              width: 130, height: 170, margin: '0 auto 16px',
              background: `linear-gradient(135deg, ${pack.color}88, ${pack.color}44)`,
              borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `3px solid ${pack.color}66`, fontSize: 60,
            }}>{pack.type === 'boost' ? '⚡' : '⚙️'}</div>
            <div style={{ fontSize: 26, fontWeight: 'bold', color: pack.color, marginBottom: 8 }}>{pack.name}</div>
            <div style={{ fontSize: 15, color: '#aaa', marginBottom: 14, minHeight: 40 }}>{pack.description}</div>
            <button onClick={() => toggleOdds(pack.type)} style={{
              background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12, marginBottom: 8,
            }}>
              {expandedOdds === pack.type ? '▲ Hide Odds' : '▼ View Odds'}
            </button>
            {expandedOdds === pack.type && (
              <div style={{ background: '#0a0a0a', borderRadius: 8, padding: 10, marginBottom: 10, textAlign: 'left' }}>
                {(pack as any).gearOdds?.map((o: any) => (
                  <div key={o.rarity} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
                    <span style={{ color: o.color, fontWeight: 'bold' }}>{o.rarity}</span>
                    <span style={{ color: '#ccc' }}>{o.pct}</span>
                  </div>
                ))}
              </div>
            )}
            <button disabled={opening || coins < pack.cost} onClick={() => buyPack(pack.type)} style={{
              width: '100%', padding: '12px', fontSize: 18, fontWeight: 'bold',
              background: coins >= pack.cost ? `linear-gradient(135deg, ${pack.color}, ${pack.color}aa)` : '#333',
              color: coins >= pack.cost ? '#fff' : '#666',
              border: 'none', borderRadius: 10, cursor: coins >= pack.cost ? 'pointer' : 'not-allowed',
            }}>
              {opening ? 'Opening...' : `${pack.cost} coins`}
            </button>
          </div>
        })}
      </div>

      {/* Pack opening results */}
      {/* Reveal animation overlay */}
      {revealing && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.85)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column',
        }}>
          {revealPhase === 1 && (
            <>
              {/* Central flash */}
              <div style={{
                width: 200, height: 200, borderRadius: '50%',
                background: `radial-gradient(circle, ${revealColor}, transparent)`,
                animation: 'packFlash 0.6s ease-out forwards',
              }} />
              <div style={{ color: '#fff', fontSize: 32, fontWeight: 'bold', marginTop: 30, letterSpacing: 2 }}>
                OPENING...
              </div>
            </>
          )}
          {revealPhase === 2 && (
            <>
              {/* Burst rays */}
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  width: 4, height: 120,
                  background: `linear-gradient(to top, ${revealColor}, transparent)`,
                  transform: `rotate(${i * 30}deg)`,
                  transformOrigin: 'bottom center',
                  top: 'calc(50% - 120px)', left: 'calc(50% - 2px)',
                  animation: `packBurst 0.8s ease-out ${i * 0.03}s forwards`,
                  opacity: 0,
                }} />
              ))}
              {/* Sparkles */}
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`s${i}`} style={{
                  position: 'absolute', fontSize: 28,
                  top: `${30 + Math.random() * 40}%`, left: `${20 + Math.random() * 60}%`,
                  animation: `sparkle 0.6s ease-in-out ${i * 0.1}s forwards`,
                  opacity: 0,
                }}>✨</div>
              ))}
              <div style={{
                color: revealColor, fontSize: 44, fontWeight: 'bold',
                textShadow: `0 0 30px ${revealColor}, 0 0 60px ${revealColor}`,
                animation: 'revealFadeIn 0.5s ease-out forwards',
                zIndex: 10,
              }}>
                PACK OPENED!
              </div>
            </>
          )}
          {revealPhase === 3 && (
            <div style={{
              color: '#fff', fontSize: 28, fontWeight: 'bold',
              animation: 'revealFadeIn 0.3s ease-out forwards',
            }}>
              Here's what you got...
            </div>
          )}
        </div>
      )}

      {/* Pack results popup overlay */}
      {packResult && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.85)', zIndex: 9998,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setPackResult(null)}>
          <div style={{
            background: 'linear-gradient(180deg, #1a0a1a, #0d0d0d)', border: '3px solid #cc2244', borderRadius: 24,
            padding: 40, maxWidth: 900, width: '95%', maxHeight: '90vh', overflowY: 'auto',
            animation: 'revealFadeIn 0.4s ease-out',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: '#FFD700', textAlign: 'center', marginBottom: 24, fontSize: 38, textShadow: '0 0 15px rgba(255,215,0,0.4)' }}>
              Pack Opened!
            </h3>

            {packResult.athletes.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#fff', marginBottom: 14, fontSize: 24 }}>Athletes</h4>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {packResult.athletes.map((a, i) => (
                    <PackCard key={i} name={a.name} rarity={a.rarity} rating={a.overallRating}
                      sub={`${a.specialtyEvent} | ${a.nationality}`}
                      color={RARITY_COLORS[a.rarity] || '#fff'} />
                  ))}
                </div>
              </div>
            )}

            {packResult.boosts.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#fff', marginBottom: 14, fontSize: 24 }}>Big Impact Cards</h4>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {packResult.boosts.map((b, i) => (
                    <PackCard key={i} name={b.name} rarity={b.rarity} rating={Math.round(b.effectMagnitude * 100)}
                      sub={b.effectType.replace(/_/g, ' ')}
                      color={b.color} isBoost />
                  ))}
                </div>
              </div>
            )}

            {packResult.perfBoosts && packResult.perfBoosts.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#00ff88', marginBottom: 14, fontSize: 24 }}>Gear</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
                  {packResult.perfBoosts.map((pb: any, i: number) => (
                    <div key={i} style={{
                      background: `linear-gradient(135deg, ${pb.color}44, ${pb.color}22)`,
                      border: `2px solid ${pb.color}`, borderRadius: 14, padding: '16px 20px',
                      textAlign: 'center', minWidth: 160,
                    }}>
                      <div style={{ fontSize: 42 }}>{pb.iconKey}</div>
                      <div style={{ fontSize: 18, fontWeight: 'bold', color: pb.color, marginTop: 6 }}>{pb.name}</div>
                      <div style={{ fontSize: 14, color: '#00ff88', marginTop: 4 }}>
                        +{pb.statBoosts.speed} SPD  +{pb.statBoosts.stamina} STA  +{pb.statBoosts.acceleration} ACC  +{pb.statBoosts.form} FRM
                      </div>
                      <div style={{ fontSize: 13, color: '#888', textTransform: 'uppercase', marginTop: 4 }}>{pb.rarity}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setPackResult(null)} style={{
              display: 'block', margin: '16px auto 0', padding: '16px 60px',
              background: 'linear-gradient(135deg, #cc2244, #991133)', color: '#fff', border: 'none', borderRadius: 12,
              fontSize: 22, fontWeight: 'bold', cursor: 'pointer', letterSpacing: 1,
            }}>COLLECT</button>
          </div>
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
