import React, { useEffect, useState } from 'react';
import { UserAthlete, UserBoost, EventType } from '@track-stars/shared';
import { api } from '../../api/client';
import { AthleteCard } from '../components/AthleteCard';
import { BoostCard } from '../components/BoostCard';

interface Props {
  onStartRace: (eventType: EventType, athleteId: string, boostIds: string[]) => void;
  onBack: () => void;
  lockedEventType?: EventType; // when accepting a challenge, event is pre-set
}

export function RaceSetup({ onStartRace, onBack, lockedEventType }: Props) {
  const [athletes, setAthletes] = useState<UserAthlete[]>([]);
  const [boosts, setBoosts] = useState<UserBoost[]>([]);
  const [loading, setLoading] = useState(true);

  const [eventType, setEventType] = useState<EventType>(lockedEventType || '200m');
  const [selectedAthlete, setSelectedAthlete] = useState<string>('');
  const [selectedBoosts, setSelectedBoosts] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([api.getAthletes(), api.getBoosts()]).then(([a, b]) => {
      setAthletes(a);
      setBoosts(b);
      setLoading(false);
    });
  }, []);

  const toggleBoost = (id: string) => {
    if (selectedBoosts.includes(id)) {
      setSelectedBoosts(selectedBoosts.filter(b => b !== id));
    } else if (selectedBoosts.length < 1) {
      setSelectedBoosts([...selectedBoosts, id]);
    }
  };

  const canStart = selectedAthlete && !loading;

  const sortedAthletes = [...athletes].sort((a, b) =>
    (b.template?.overallRating || 0) - (a.template?.overallRating || 0)
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a2e, #1a1a0e)',
      padding: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <button onClick={onBack} style={backBtnStyle}>Back</button>
        <h2 style={{ color: '#fff', margin: 0 }}>Race Setup</h2>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Loading...</div>
      ) : athletes.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>
          No athletes! Visit the Shop first to buy card packs.
        </div>
      ) : (
        <>
          {/* Step 1: Event Selection */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ color: '#FFD700', marginBottom: 14, fontSize: 22 }}>
              {lockedEventType ? '1. Event' : '1. Choose Event'}
            </h3>
            {lockedEventType ? (
              <div style={{
                display: 'inline-block', padding: '16px 44px', fontSize: 22, fontWeight: 'bold',
                background: 'linear-gradient(135deg, #FFD700, #ff8800)', color: '#000',
                borderRadius: 10,
              }}>{lockedEventType}</div>
            ) : (
              <div style={{ display: 'flex', gap: 12 }}>
                {(['200m', '400m', '800m', '2000mSC'] as EventType[]).map(e => (
                  <button key={e} onClick={() => setEventType(e)} style={{
                    padding: '16px 44px', fontSize: 22, fontWeight: 'bold',
                    background: eventType === e ? 'linear-gradient(135deg, #FFD700, #ff8800)' : '#222',
                    color: eventType === e ? '#000' : '#888',
                    border: eventType === e ? '2px solid #FFD700' : '2px solid #444',
                    borderRadius: 10, cursor: 'pointer',
                  }}>
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 2: Athlete Selection */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ color: '#FFD700', marginBottom: 14, fontSize: 22 }}>2. Select Your Athlete</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {sortedAthletes.map(a => (
                <AthleteCard
                  key={a.id}
                  athlete={a}
                  selected={selectedAthlete === a.id}
                  onClick={() => setSelectedAthlete(a.id)}
                  compact
                />
              ))}
            </div>
          </div>

          {/* Step 3: Boost Selection */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ color: '#FFD700', marginBottom: 10, fontSize: 22 }}>3. Select a Big Impact Card (1 per race)</h3>
            <p style={{ color: '#888', fontSize: 16, marginBottom: 14 }}>
              These boosts will activate during the race to give your athlete an edge!
            </p>
            {boosts.length === 0 ? (
              <p style={{ color: '#666', fontSize: 13 }}>No boosts available. Buy packs to earn boost cards!</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {boosts.map(b => (
                  <BoostCard
                    key={b.id}
                    boost={b}
                    selected={selectedBoosts.includes(b.id)}
                    onClick={() => toggleBoost(b.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Start Button */}
          <div style={{ textAlign: 'center', paddingTop: 10 }}>
            <button
              onClick={() => canStart && onStartRace(eventType, selectedAthlete, selectedBoosts)}
              disabled={!canStart}
              style={{
                padding: '18px 80px', fontSize: 26, fontWeight: 'bold',
                background: canStart ? 'linear-gradient(135deg, #ff4444, #ff0000)' : '#333',
                color: canStart ? '#fff' : '#666',
                border: 'none', borderRadius: 12, cursor: canStart ? 'pointer' : 'not-allowed',
                boxShadow: canStart ? '0 0 20px rgba(255,0,0,0.4)' : 'none',
                textTransform: 'uppercase', letterSpacing: 2,
              }}
            >
              START RACE
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  background: '#333', color: '#fff', border: '1px solid #555',
  borderRadius: 10, padding: '12px 24px', cursor: 'pointer', fontSize: 18,
};
