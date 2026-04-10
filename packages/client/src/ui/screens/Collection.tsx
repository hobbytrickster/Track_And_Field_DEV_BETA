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
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selling, setSelling] = useState(false);
  const [perfBoosts, setPerfBoosts] = useState<any[]>([]);
  const [showBoosts, setShowBoosts] = useState(false);

  useEffect(() => {
    Promise.all([api.getAthletes(), api.getPerfBoosts()]).then(([ath, pbs]) => {
      setAthletes(ath);
      setPerfBoosts(pbs);
      setLoading(false);
    });
  }, []);

  const filtered = filter === 'all' ? athletes :
    athletes.filter(a => a.template?.specialtyEvent === filter);

  const sorted = [...filtered].sort((a, b) =>
    (b.template?.overallRating || 0) - (a.template?.overallRating || 0)
  );

  const toggleMultiSelect = () => {
    setMultiSelect(!multiSelect);
    setSelectedIds(new Set());
    if (!multiSelect) setSelected(null);
  };

  const toggleCard = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const sellValues: Record<string, number> = { bronze: 25, silver: 50, gold: 100, platinum: 200, diamond: 500, superstar: 2000, legend: 5000 };

  const getSelectionValue = () => {
    let total = 0;
    for (const id of selectedIds) {
      const a = athletes.find(x => x.id === id);
      if (a?.template) total += sellValues[a.template.rarity] || 25;
    }
    return total;
  };

  const sellSelected = async () => {
    // Filter to only IDs that still exist in athletes list
    const validIds = Array.from(selectedIds).filter(id => athletes.some(a => a.id === id));
    if (validIds.length === 0) { alert('No athletes selected.'); return; }

    const count = validIds.length;
    const totalValue = validIds.reduce((sum, id) => {
      const a = athletes.find(x => x.id === id);
      return sum + (a?.template ? (sellValues[a.template.rarity] || 25) : 25);
    }, 0);

    const names = validIds.slice(0, 5).map(id => {
      const a = athletes.find(x => x.id === id);
      return a?.template ? `${a.template.name} (${a.template.rarity})` : 'Unknown';
    });
    const nameList = names.join('\n  ') + (count > 5 ? `\n  ...and ${count - 5} more` : '');

    // Must keep at least 1 athlete
    if (athletes.length - count < 1) {
      alert(`You must keep at least 1 athlete!\nYou have ${athletes.length} — select at most ${athletes.length - 1} to sell.`);
      return;
    }

    if (!window.confirm(
      `Sell ${count} athlete${count > 1 ? 's' : ''}?\n\n  ${nameList}\n\nTotal value: ${totalValue} coins\nThis cannot be undone!`
    )) return;

    setSelling(true);
    let totalEarned = 0;
    let lastBalance = 0;
    let soldCount = 0;
    const errors: string[] = [];
    for (const id of validIds) {
      try {
        const result = await api.releaseAthlete(id);
        totalEarned += result.coinsEarned;
        lastBalance = result.newBalance;
        soldCount++;
      } catch (err: any) {
        errors.push(err.message || 'Unknown error');
      }
    }

    // Always refresh from server
    try {
      const fresh = await api.getAthletes();
      setAthletes(fresh);
    } catch {}

    setSelectedIds(new Set());
    setMultiSelect(false);
    setSelling(false);
    setSelected(null);

    if (soldCount > 0) {
      alert(`Sold ${soldCount} athlete${soldCount > 1 ? 's' : ''} for ${totalEarned} coins!\nNew balance: ${lastBalance}`);
    } else {
      alert('No athletes were sold.\n\n' + (errors.length > 0 ? 'Errors:\n' + errors.join('\n') : 'No errors captured.'));
    }
  };

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={toggleMultiSelect} style={{
            background: multiSelect ? '#cc2244' : '#333',
            color: '#fff', border: multiSelect ? '2px solid #ff3355' : '1px solid #555',
            borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontSize: 15, fontWeight: 'bold',
          }}>
            {multiSelect ? `CANCEL (${selectedIds.size})` : 'MULTI-SELECT'}
          </button>
          {['all', '200m', '400m', '800m', '2000mSC'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? '#FFD700' : '#333',
              color: filter === f ? '#000' : '#888',
              border: 'none', borderRadius: 10, padding: '10px 22px',
              cursor: 'pointer', fontWeight: 'bold', fontSize: 17,
            }}>{f.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* Multi-select action bar */}
      {multiSelect && selectedIds.size > 0 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#2a1010', border: '2px solid #cc2244', borderRadius: 10,
          padding: '12px 20px', marginBottom: 16,
        }}>
          <div style={{ color: '#fff', fontSize: 16 }}>
            <span style={{ fontWeight: 'bold', color: '#cc2244' }}>{selectedIds.size}</span> selected —
            worth <span style={{ fontWeight: 'bold', color: '#FFD700' }}>{getSelectionValue()} coins</span>
          </div>
          <button onClick={sellSelected} disabled={selling} style={{
            background: '#cc2244', color: '#fff', border: 'none', borderRadius: 8,
            padding: '10px 24px', fontSize: 16, fontWeight: 'bold', cursor: 'pointer',
            opacity: selling ? 0.6 : 1,
          }}>
            {selling ? 'Selling...' : `SELL ${selectedIds.size} ATHLETE${selectedIds.size > 1 ? 'S' : ''}`}
          </button>
        </div>
      )}

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
              <div key={a.id} style={{ position: 'relative' }}>
                {multiSelect && (
                  <div style={{
                    position: 'absolute', top: 4, right: 4, zIndex: 10,
                    width: 24, height: 24, borderRadius: '50%',
                    background: selectedIds.has(a.id) ? '#cc2244' : '#333',
                    border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 14, fontWeight: 'bold', cursor: 'pointer',
                  }} onClick={(e) => { e.stopPropagation(); toggleCard(a.id); }}>
                    {selectedIds.has(a.id) ? '✓' : ''}
                  </div>
                )}
                <AthleteCard
                  athlete={a}
                  selected={multiSelect ? selectedIds.has(a.id) : selected?.id === a.id}
                  onClick={() => multiSelect ? toggleCard(a.id) : setSelected(a)}
                  compact
                />
              </div>
            ))}
          </div>

          {/* Detail panel (only in single-select mode) */}
          {!multiSelect && selected && (
            <div style={{
              width: 440, background: 'rgba(20,20,50,0.8)', borderRadius: 14,
              padding: 24, border: '1px solid #444', overflowY: 'auto', maxHeight: '95vh',
              minHeight: 800,
            }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <AthleteCard athlete={selected} />
              </div>
              {onCustomize && (
                <button onClick={() => onCustomize(selected.id)} style={{
                  width: '100%', marginTop: 16, padding: '14px', fontSize: 18, fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #ff6688, #ff4466)', color: '#fff',
                  border: 'none', borderRadius: 12, cursor: 'pointer',
                }}>
                  Customize Look
                </button>
              )}
              <div style={{ marginTop: 10, textAlign: 'center', fontSize: 14, color: '#888' }}>
                {(selected as any).appearance ? 'Custom look applied' : 'Default look'}
              </div>

              {/* Performance Boost Application */}
              {(() => {
                const applied = (selected as any).appliedPerfBoosts || [];
                const slotsLeft = 3 - applied.length;
                return (
                  <div style={{ marginTop: 14, padding: 14, background: 'rgba(0,0,0,0.3)', borderRadius: 10 }}>
                    <div style={{ color: '#00ff88', fontWeight: 'bold', fontSize: 17, marginBottom: 10 }}>
                      GEAR ({applied.length}/3)
                    </div>
                    {applied.map((pb: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: '#ccc', marginBottom: 6 }}>
                        <span style={{ fontSize: 24 }}>{pb.iconKey}</span>
                        <span style={{ color: pb.color, fontWeight: 'bold' }}>{pb.name}</span>
                        <span style={{ color: '#00ff88', fontSize: 12 }}>+{pb.statBoosts.speed} SPD  +{pb.statBoosts.stamina} STA  +{pb.statBoosts.acceleration} ACC  +{pb.statBoosts.form} FRM</span>
                      </div>
                    ))}
                    {slotsLeft > 0 && (
                      <button onClick={() => setShowBoosts(!showBoosts)} style={{
                        width: '100%', marginTop: 8, padding: '10px', fontSize: 15, fontWeight: 'bold',
                        background: '#224422', color: '#00ff88', border: '2px solid #00ff88',
                        borderRadius: 8, cursor: 'pointer',
                      }}>
                        {showBoosts ? 'HIDE GEAR' : `ADD GEAR (${slotsLeft} slot${slotsLeft > 1 ? 's' : ''} left)`}
                      </button>
                    )}
                    {showBoosts && slotsLeft > 0 && (
                      <div style={{ marginTop: 10, maxHeight: 250, overflowY: 'auto' }}>
                        {perfBoosts.filter(b => b.quantity > 0).length === 0 ? (
                          <div style={{ color: '#666', fontSize: 14, textAlign: 'center', padding: 10 }}>No gear available. Buy packs!</div>
                        ) : perfBoosts.filter(b => b.quantity > 0 && !applied.some((a: any) => a.id === b.template?.id)).map((b: any) => {
                          const rarityColors: Record<string, string> = { bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700', platinum: '#E5E4E2', diamond: '#B9F2FF', superstar: '#aa44ff', legend: '#ff8800' };
                          const rc = rarityColors[b.template.rarity] || '#888';
                          return (
                          <div key={b.id} style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                            background: `linear-gradient(135deg, ${rc}15, ${rc}08)`,
                            borderRadius: 10, marginBottom: 8, cursor: 'pointer',
                            border: `2px solid ${rc}66`,
                          }} onClick={async () => {
                            if (!window.confirm(`Apply ${b.template.name} to this athlete?\n\n+${b.template.statBoosts.speed} SPD, +${b.template.statBoosts.stamina} STA, +${b.template.statBoosts.acceleration} ACC, +${b.template.statBoosts.form} FRM\n\nThis CANNOT be undone!`)) return;
                            try {
                              await api.applyPerfBoost(selected.id, b.template.id);
                              const [freshAthletes, freshBoosts] = await Promise.all([api.getAthletes(), api.getPerfBoosts()]);
                              setAthletes(freshAthletes);
                              setPerfBoosts(freshBoosts);
                              setSelected(freshAthletes.find((a: any) => a.id === selected.id) || null);
                            } catch (err: any) { alert('Error: ' + err.message); }
                          }}>
                            <div style={{
                              width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: `radial-gradient(circle, ${rc}55, ${rc}22)`, border: `2px solid ${rc}`,
                              fontSize: 24, flexShrink: 0,
                            }}>{b.template.iconKey}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 16, fontWeight: 'bold', color: b.template.color }}>{b.template.name}</span>
                                <span style={{
                                  fontSize: 10, fontWeight: 'bold', color: rc, textTransform: 'uppercase',
                                  background: `${rc}22`, padding: '1px 6px', borderRadius: 4, border: `1px solid ${rc}44`,
                                }}>{b.template.rarity}</span>
                                <span style={{ color: '#888', fontSize: 13 }}>x{b.quantity}</span>
                              </div>
                              <div style={{ fontSize: 14, color: '#00ff88', marginTop: 2, fontWeight: 'bold' }}>
                                +{b.template.statBoosts.speed} SPD  +{b.template.statBoosts.stamina} STA  +{b.template.statBoosts.acceleration} ACC  +{b.template.statBoosts.form} FRM
                              </div>
                              <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{b.template.description}</div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Race Stats */}
              {(() => {
                const rs = (selected as any).raceStats;
                if (!rs || rs.totalRaces === 0) return (
                  <div style={{ marginTop: 14, padding: 12, background: 'rgba(0,0,0,0.3)', borderRadius: 10, fontSize: 14, color: '#666', textAlign: 'center' }}>
                    No race history yet
                  </div>
                );
                return (
                  <div style={{ marginTop: 14, padding: 14, background: 'rgba(0,0,0,0.3)', borderRadius: 10, fontSize: 15 }}>
                    <div style={{ color: '#FFD700', fontWeight: 'bold', marginBottom: 8, fontSize: 17 }}>RACE STATS</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc', marginBottom: 3 }}>
                      <span>Races</span><span style={{ fontWeight: 'bold' }}>{rs.totalRaces}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#44ff44', marginBottom: 3 }}>
                      <span>Wins (1st)</span><span style={{ fontWeight: 'bold' }}>{rs.wins}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#C0C0C0', marginBottom: 3 }}>
                      <span>Podiums (2nd/3rd)</span><span style={{ fontWeight: 'bold' }}>{rs.podiums}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ff6666', marginBottom: 3 }}>
                      <span>Last Place</span><span style={{ fontWeight: 'bold' }}>{rs.lastPlaces}</span>
                    </div>
                    {rs.bestTimes && Object.keys(rs.bestTimes).length > 0 && (
                      <>
                        <div style={{ color: '#FFD700', fontWeight: 'bold', marginTop: 8, marginBottom: 6, fontSize: 15 }}>BEST TIMES</div>
                        {Object.entries(rs.bestTimes).map(([evt, ms]: [string, any]) => {
                          const t2 = ms >= 60000 ? `${Math.floor(ms/60000)}:${((ms%60000)/1000).toFixed(3).padStart(6,'0')}` : `${(ms/1000).toFixed(3)}`;
                          return <div key={evt} style={{ display: 'flex', justifyContent: 'space-between', color: '#ccc', marginBottom: 2 }}>
                            <span>{evt}</span><span style={{ fontWeight: 'bold', color: '#FFD700' }}>{t2}</span>
                          </div>;
                        })}
                      </>
                    )}
                  </div>
                );
              })()}
              <button onClick={async (e) => {
                e.stopPropagation();
                if (athletes.length <= 1) { alert('You must keep at least 1 athlete!'); return; }
                const t = selected.template;
                const value = sellValues[t?.rarity || 'bronze'] || 25;
                if (window.confirm(`Sell ${t?.name || 'this athlete'}? (${t?.rarity} ${t?.overallRating} OVR)\n\nYou'll receive ${value} coins.\nThis cannot be undone!`)) {
                  try {
                    const result = await api.releaseAthlete(selected.id);
                    setSelected(null);
                    const fresh = await api.getAthletes();
                    setAthletes(fresh);
                    alert(`Sold for ${result.coinsEarned} coins! New balance: ${result.newBalance}`);
                  } catch (err: any) { alert('Sell failed: ' + err.message); }
                }
              }} style={{
                width: '100%', marginTop: 14, padding: '12px', fontSize: 16, fontWeight: 'bold',
                background: '#442222', color: '#ff6666', border: '1px solid #663333',
                borderRadius: 10, cursor: 'pointer',
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
