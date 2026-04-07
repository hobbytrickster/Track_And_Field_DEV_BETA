import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatRaceTime } from '../../phaser/utils/trackGeometry';

interface Friend {
  id: string; displayName: string; level: number; wins: number; losses: number;
  h2h: { wins: number; losses: number; draws: number };
  friendCode: string;
}

interface HistoryEntry {
  challengeId: string; eventType: string;
  myTime: number; myPos: number; theirTime: number; theirPos: number;
  createdAt: string;
}

interface PendingChallenge {
  challengeId: string; eventType: string; creatorName: string;
  creatorId: string; createdAt: string; expiresAt: string;
}

interface ChallengeItem {
  challengeId: string; eventType: string; status: string;
  opponentName: string; isCreator: boolean;
  myEntry: { status: string; viewedResult: boolean } | null;
  progress?: string;
  createdAt: string;
}

interface Props {
  onBack: () => void;
  onChallenge: (friendIds: string[]) => void;
  onAcceptChallenge?: (challengeId: string, eventType: string) => void;
  onViewResult?: (challengeId: string) => void;
}

export function Friends({ onBack, onChallenge, onAcceptChallenge, onViewResult }: Props) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [myCode, setMyCode] = useState('');
  const [addCode, setAddCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [pending, setPending] = useState<PendingChallenge[]>([]);
  const [allChallenges, setAllChallenges] = useState<ChallengeItem[]>([]);
  const [tab, setTab] = useState<'friends' | 'challenges'>('friends');
  const [challengeSelect, setChallengeSelect] = useState<Set<string>>(new Set());

  const refresh = async () => {
    const [friendsData, codeData, pendingData, allData] = await Promise.all([
      api.getFriends(), api.getFriendCode(), api.getPendingChallenges(), api.getChallengeList(),
    ]).catch(() => [friends, myCode, pending, allChallenges]); // keep old data on error
    setFriends(friendsData);
    setMyCode(codeData.code);
    setPending(pendingData);
    setAllChallenges(allData);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // Poll for updates every 10 seconds
    const interval = setInterval(() => { refresh(); }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAdd = async () => {
    setError(''); setSuccess('');
    try {
      const result = await api.addFriend(addCode);
      setSuccess(`Added ${result.friend?.displayName || 'friend'}!`);
      setAddCode('');
      refresh();
    } catch (err: any) { setError(err.message); }
  };

  const handleRemove = async (fid: string) => {
    if (!window.confirm('Remove this friend?')) return;
    await api.removeFriend(fid);
    setSelectedFriend(null);
    refresh();
  };

  const loadHistory = async (f: Friend) => {
    setSelectedFriend(f);
    const h = await api.getFriendHistory(f.id);
    setHistory(h);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #1a0a0a, #0d0d0d)', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={onBack} style={backBtnStyle}>Back</button>
        <h2 style={{ color: '#fff', margin: 0, fontSize: 24 }}>Friends</h2>
      </div>

      {/* Tab buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab('friends')} style={{
          flex: 1, padding: '12px', fontSize: 17, fontWeight: 'bold', cursor: 'pointer',
          background: tab === 'friends' ? '#cc2244' : '#222', color: '#fff',
          border: tab === 'friends' ? '2px solid #ff3355' : '1px solid #444', borderRadius: 10,
        }}>FRIENDS ({friends.length})</button>
        <button onClick={() => setTab('challenges')} style={{
          flex: 1, padding: '12px', fontSize: 17, fontWeight: 'bold', cursor: 'pointer',
          background: tab === 'challenges' ? '#cc2244' : '#222', color: '#fff',
          border: tab === 'challenges' ? '2px solid #ff3355' : '1px solid #444', borderRadius: 10,
          position: 'relative',
        }}>
          CHALLENGES {pending.length > 0 && <span style={{
            position: 'absolute', top: -6, right: -6, background: '#ff3355', color: '#fff',
            borderRadius: '50%', width: 22, height: 22, fontSize: 12, fontWeight: 'bold',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{pending.length}</span>}
        </button>
      </div>

      {tab === 'challenges' && (
        <div style={{ marginBottom: 20 }}>
          {pending.length > 0 && (
            <>
              <h3 style={{ color: '#cc2244', fontSize: 18, marginBottom: 10 }}>Incoming ({pending.length})</h3>
              {pending.map(p => (
                <div key={p.challengeId} style={{
                  background: '#1a1010', border: '2px solid #cc2244', borderRadius: 12,
                  padding: '14px 18px', marginBottom: 10, display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: 17, fontWeight: 'bold' }}>{p.creatorName} challenges you!</div>
                    <div style={{ color: '#cc2244', fontSize: 15, fontWeight: 'bold' }}>{p.eventType}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => onAcceptChallenge?.(p.challengeId, p.eventType)} style={{
                      background: '#44aa44', color: '#fff', border: 'none', borderRadius: 8,
                      padding: '10px 20px', fontSize: 15, fontWeight: 'bold', cursor: 'pointer',
                    }}>ACCEPT</button>
                    <button onClick={async () => { await api.declineChallenge(p.challengeId); refresh(); }} style={{
                      background: '#444', color: '#aaa', border: 'none', borderRadius: 8,
                      padding: '10px 14px', fontSize: 13, cursor: 'pointer',
                    }}>Decline</button>
                  </div>
                </div>
              ))}
            </>
          )}

          <h3 style={{ color: '#fff', fontSize: 18, marginBottom: 10 }}>All Challenges</h3>
          {allChallenges.length === 0 ? <div style={{ color: '#888' }}>No challenges yet</div> :
            allChallenges.map((c: ChallengeItem) => (
              <div key={c.challengeId} style={{
                background: '#111', border: '1px solid #333', borderRadius: 10,
                padding: '12px 16px', marginBottom: 8, display: 'flex',
                justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 15 }}>
                    {c.isCreator ? `You → ${c.opponentName}` : `${c.opponentName} → You`}
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ color: '#cc2244', fontWeight: 'bold' }}>{c.eventType}</span>
                    <span style={{
                      fontSize: 12, padding: '2px 8px', borderRadius: 4,
                      background: c.status === 'simulated' ? '#224422' : c.status === 'pending' ? '#443300' : '#442222',
                      color: c.status === 'simulated' ? '#44ff44' : c.status === 'pending' ? '#ffaa44' : '#ff6666',
                    }}>{c.status === 'simulated' ? 'COMPLETE' : c.status === 'pending' ? `WAITING ${(c as any).progress || ''}` : c.status.toUpperCase()}</span>
                  </div>
                </div>
                {c.status === 'simulated' && onViewResult && (
                  <button onClick={() => onViewResult(c.challengeId)} style={{
                    background: c.myEntry?.viewedResult ? '#333' : '#cc2244', color: '#fff',
                    border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer',
                  }}>{c.myEntry?.viewedResult ? 'REWATCH' : 'WATCH'}</button>
                )}
              </div>
            ))
          }
        </div>
      )}

      {tab === 'friends' && <>
      {/* My code + add friend */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: 16, flex: 1, minWidth: 250 }}>
          <div style={{ color: '#888', fontSize: 13, marginBottom: 6 }}>Your Friend Code</div>
          <div style={{ color: '#cc2244', fontSize: 28, fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: 3 }}>{myCode}</div>
          <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>Share this code with friends so they can add you</div>
        </div>
        <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: 16, flex: 1, minWidth: 250 }}>
          <div style={{ color: '#888', fontSize: 13, marginBottom: 6 }}>Add a Friend</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={addCode} onChange={e => setAddCode(e.target.value)}
              placeholder="Enter friend code..." maxLength={13}
              style={{ flex: 1, padding: '10px 14px', fontSize: 16, fontFamily: 'monospace', background: '#111', border: '1px solid #444', borderRadius: 8, color: '#fff', outline: 'none' }} />
            <button onClick={handleAdd} style={{
              background: '#cc2244', color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 20px', fontSize: 16, fontWeight: 'bold', cursor: 'pointer',
            }}>ADD</button>
          </div>
          {error && <div style={{ color: '#ff4444', fontSize: 13, marginTop: 6 }}>{error}</div>}
          {success && <div style={{ color: '#44ff44', fontSize: 13, marginTop: 6 }}>{success}</div>}
        </div>
      </div>

      {/* Friend list + detail */}
      <div style={{ display: 'flex', gap: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ color: '#fff', margin: 0, fontSize: 18 }}>Friends ({friends.length})</h3>
            {challengeSelect.size > 0 && (
              <button onClick={() => { onChallenge(Array.from(challengeSelect)); setChallengeSelect(new Set()); }} style={{
                background: '#cc2244', color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 18px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer',
              }}>CHALLENGE {challengeSelect.size} FRIEND{challengeSelect.size > 1 ? 'S' : ''}</button>
            )}
          </div>
          {loading ? <div style={{ color: '#888' }}>Loading...</div> :
            friends.length === 0 ? <div style={{ color: '#888' }}>No friends yet. Share your code!</div> :
            friends.map((f: Friend) => (
              <div key={f.id} onClick={() => loadHistory(f)} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: challengeSelect.has(f.id) ? '#1a0a2a' : selectedFriend?.id === f.id ? '#2a1a1a' : '#111',
                border: challengeSelect.has(f.id) ? '1px solid #aa44ff' : selectedFriend?.id === f.id ? '1px solid #cc2244' : '1px solid #222',
                borderRadius: 10, padding: '12px 16px', marginBottom: 8, cursor: 'pointer',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div onClick={(e) => {
                    e.stopPropagation();
                    const next = new Set(challengeSelect);
                    if (next.has(f.id)) next.delete(f.id); else if (next.size < 7) next.add(f.id);
                    setChallengeSelect(next);
                  }} style={{
                    width: 22, height: 22, borderRadius: 4, border: '2px solid #666',
                    background: challengeSelect.has(f.id) ? '#aa44ff' : '#333',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 14, fontWeight: 'bold', cursor: 'pointer', flexShrink: 0,
                  }}>{challengeSelect.has(f.id) ? '✓' : ''}</div>
                  <div>
                    <div style={{ color: '#fff', fontSize: 17, fontWeight: 'bold' }}>{f.displayName}</div>
                    <div style={{ color: '#888', fontSize: 13 }}>Level {f.level} | {f.wins}W-{f.losses}L</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#cc2244', fontSize: 14, fontWeight: 'bold' }}>
                    H2H: {f.h2h.wins}-{f.h2h.losses}{f.h2h.draws > 0 ? `-${f.h2h.draws}` : ''}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onChallenge([f.id]); }} style={{
                    marginTop: 4, background: '#cc2244', color: '#fff', border: 'none',
                    borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer',
                  }}>CHALLENGE</button>
                </div>
              </div>
            ))
          }
        </div>

        {/* Selected friend detail + history */}
        {selectedFriend && (
          <div style={{ width: 350, background: '#1a1a1a', borderRadius: 12, padding: 16, border: '1px solid #333' }}>
            <h3 style={{ color: '#fff', fontSize: 18, marginBottom: 4 }}>{selectedFriend.displayName}</h3>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>Code: {selectedFriend.friendCode}</div>
            <div style={{ color: '#cc2244', fontSize: 16, fontWeight: 'bold', marginBottom: 12 }}>
              Head-to-Head: {selectedFriend.h2h.wins}W - {selectedFriend.h2h.losses}L - {selectedFriend.h2h.draws}D
            </div>

            <h4 style={{ color: '#aaa', fontSize: 14, marginBottom: 8 }}>Race History</h4>
            {history.length === 0 ? <div style={{ color: '#666', fontSize: 13 }}>No races yet</div> :
              history.map(h => (
                <div key={h.challengeId} style={{
                  background: '#111', borderRadius: 8, padding: '8px 12px', marginBottom: 6,
                  border: `1px solid ${h.myPos < h.theirPos ? '#224422' : h.myPos > h.theirPos ? '#442222' : '#333'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>{h.eventType}</span>
                    <span style={{ color: h.myPos < h.theirPos ? '#44ff44' : h.myPos > h.theirPos ? '#ff4444' : '#aaa', fontWeight: 'bold' }}>
                      {h.myPos < h.theirPos ? 'WIN' : h.myPos > h.theirPos ? 'LOSS' : 'DRAW'}
                    </span>
                  </div>
                  <div style={{ color: '#888', fontSize: 12 }}>
                    You: P{h.myPos} {formatRaceTime(h.myTime)} | Them: P{h.theirPos} {formatRaceTime(h.theirTime)}
                  </div>
                </div>
              ))
            }

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => onChallenge([selectedFriend.id])} style={{
                flex: 1, background: '#cc2244', color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px', fontSize: 15, fontWeight: 'bold', cursor: 'pointer',
              }}>CHALLENGE</button>
              <button onClick={() => handleRemove(selectedFriend.id)} style={{
                background: '#333', color: '#888', border: '1px solid #444', borderRadius: 8,
                padding: '10px 14px', fontSize: 13, cursor: 'pointer',
              }}>Remove</button>
            </div>
          </div>
        )}
      </div>
      </>}
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: '#333', color: '#fff', border: '1px solid #555',
  borderRadius: 10, padding: '12px 24px', cursor: 'pointer', fontSize: 18,
};
