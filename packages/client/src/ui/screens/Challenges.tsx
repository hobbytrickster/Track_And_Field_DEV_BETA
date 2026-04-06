import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface PendingChallenge {
  challengeId: string; eventType: string; creatorName: string;
  creatorId: string; createdAt: string; expiresAt: string;
}

interface ChallengeItem {
  challengeId: string; eventType: string; status: string;
  opponentName: string; opponentId: string; isCreator: boolean;
  myEntry: { status: string; viewedResult: boolean } | null;
  createdAt: string;
}

interface Props {
  onBack: () => void;
  onAccept: (challengeId: string, eventType: string) => void;
  onViewResult: (challengeId: string) => void;
}

export function Challenges({ onBack, onAccept, onViewResult }: Props) {
  const [pending, setPending] = useState<PendingChallenge[]>([]);
  const [all, setAll] = useState<ChallengeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const [p, a] = await Promise.all([api.getPendingChallenges(), api.getChallengeList()]);
    setPending(p);
    setAll(a);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const decline = async (id: string) => {
    if (!window.confirm('Decline this challenge?')) return;
    await api.declineChallenge(id);
    refresh();
  };

  const timeLeft = (expiresAt: string) => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'Expired';
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hrs}h ${mins}m left`;
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #1a0a0a, #0d0d0d)', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={onBack} style={backBtnStyle}>Back</button>
        <h2 style={{ color: '#fff', margin: 0, fontSize: 24 }}>Challenges</h2>
      </div>

      {loading ? <div style={{ color: '#888' }}>Loading...</div> : (
        <>
          {/* Pending incoming challenges */}
          {pending.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ color: '#cc2244', fontSize: 18, marginBottom: 10 }}>
                Incoming Challenges ({pending.length})
              </h3>
              {pending.map(p => (
                <div key={p.challengeId} style={{
                  background: '#1a1010', border: '2px solid #cc2244', borderRadius: 12,
                  padding: '14px 18px', marginBottom: 10, display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <div style={{ color: '#fff', fontSize: 17, fontWeight: 'bold' }}>
                      {p.creatorName} challenges you!
                    </div>
                    <div style={{ color: '#cc2244', fontSize: 15, fontWeight: 'bold' }}>{p.eventType}</div>
                    <div style={{ color: '#888', fontSize: 12 }}>{timeLeft(p.expiresAt)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => onAccept(p.challengeId, p.eventType)} style={{
                      background: '#44aa44', color: '#fff', border: 'none', borderRadius: 8,
                      padding: '10px 20px', fontSize: 15, fontWeight: 'bold', cursor: 'pointer',
                    }}>ACCEPT</button>
                    <button onClick={() => decline(p.challengeId)} style={{
                      background: '#444', color: '#aaa', border: 'none', borderRadius: 8,
                      padding: '10px 14px', fontSize: 13, cursor: 'pointer',
                    }}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* All challenges */}
          <h3 style={{ color: '#fff', fontSize: 18, marginBottom: 10 }}>All Challenges</h3>
          {all.length === 0 ? <div style={{ color: '#888' }}>No challenges yet</div> :
            all.map((c: ChallengeItem) => (
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
                    }}>
                      {c.status === 'simulated' ? 'COMPLETE' : c.status === 'pending' ? 'WAITING' : c.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                {c.status === 'simulated' && (
                  <button onClick={() => onViewResult(c.challengeId)} style={{
                    background: c.myEntry?.viewedResult ? '#333' : '#cc2244',
                    color: '#fff', border: 'none', borderRadius: 8,
                    padding: '8px 16px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer',
                  }}>{c.myEntry?.viewedResult ? 'REWATCH' : 'WATCH RACE'}</button>
                )}
              </div>
            ))
          }
        </>
      )}
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: '#333', color: '#fff', border: '1px solid #555',
  borderRadius: 10, padding: '12px 24px', cursor: 'pointer', fontSize: 18,
};
