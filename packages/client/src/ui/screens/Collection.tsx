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

  const sellValues: Record<string, number> = { bronze: 25, silver: 50, gold: 100, platinum: 200, diamond: 500 };

  const getSelectionValue = () => {
    let total = 0;
    for (const id of selectedIds) {
      const a = athletes.find(x => x.id === id);
      if (a?.template) total += sellValues[a.template.rarity] || 25;
    }
    return total;
  };

  const sellSelected = async () => {
    if (selectedIds.size === 0) return;
    const totalValue = getSelectionValue();
    const count = selectedIds.size;

    const names = Array.from(selectedIds).slice(0, 5).map(id => {
      const a = athletes.find(x => x.id === id);
      return a?.template ? `${a.template.name} (${a.template.rarity})` : 'Unknown';
    });
    const nameList = names.join('\n  ') + (count > 5 ? `\n  ...and ${count - 5} more` : '');

    if (!window.confirm(
      `Sell ${count} athlete${count > 1 ? 's' : ''}?\n\n  ${nameList}\n\nTotal value: ${totalValue} coins\nThis cannot be undone!`
    )) return;

    setSelling(true);
    let totalEarned = 0;
    let lastBalance = 0;
    for (const id of selectedIds) {
      try {
        const result = await api.releaseAthlete(id);
        totalEarned += result.coinsEarned;
        lastBalance = result.newBalance;
      } catch { /* skip failed ones */ }
    }
    setAthletes(prev => prev.filter(a => !selectedIds.has(a.id)));
    setSelectedIds(new Set());
    setMultiSelect(false);
    setSelling(false);
    alert(`Sold ${count} athlete${count > 1 ? 's' : ''} for ${totalEarned} coins!\nNew balance: ${lastBalance}`);
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
              <button onClick={async (e) => {
                e.stopPropagation();
                const t = selected.template;
                const value = sellValues[t?.rarity || 'bronze'] || 25;
                if (window.confirm(`Sell ${t?.name || 'this athlete'}? (${t?.rarity} ${t?.overallRating} OVR)\n\nYou'll receive ${value} coins.\nThis cannot be undone!`)) {
                  try {
                    const result = await api.releaseAthlete(selected.id);
                    setAthletes(prev => prev.filter(a => a.id !== selected.id));
                    setSelected(null);
                    alert(`Sold for ${result.coinsEarned} coins! New balance: ${result.newBalance}`);
                  } catch (err: any) { alert('Sell failed: ' + err.message); }
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
