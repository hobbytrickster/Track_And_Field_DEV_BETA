import React, { useEffect, useState } from 'react';
import { UserAthlete, UserBoost, EventType } from '@track-stars/shared';
import { api } from '../../api/client';
import { AthleteCard } from '../components/AthleteCard';
import { BoostCard } from '../components/BoostCard';

interface Props {
  onStartRace: (eventType: EventType, athleteId: string, boostIds: string[]) => void;
  onBack: () => void;
  lockedEventType?: EventType;
}

export function RaceSetup({ onStartRace, onBack, lockedEventType }: Props) {
  const [athletes, setAthletes] = useState<UserAthlete[]>([]);
  const [boosts, setBoosts] = useState<UserBoost[]>([]);
  const [loading, setLoading] = useState(true);

  const [eventType, setEventType] = useState<EventType | null>(lockedEventType || null);
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
      setSelectedBoosts([]);
    } else {
      setSelectedBoosts([id]);
    }
  };

  const canStart = eventType && selectedAthlete && !loading;

  const sortedAthletes = [...athletes].sort((a, b) =>
    (b.template?.overallRating || 0) - (a.template?.overallRating || 0)
  );

  // Which step is the "active" (most prominent) one
  const activeStep = !eventType ? 1 : !selectedAthlete ? 2 : 3;

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
          {/* ═══ STEP 1: EVENT ═══ */}
          <div style={{
            marginBottom: 28, textAlign: 'center',
            padding: activeStep === 1 ? '24px' : '12px',
            background: activeStep === 1 ? 'rgba(255,215,0,0.08)' : 'transparent',
            border: activeStep === 1 ? '2px solid #FFD70044' : 'none',
            borderRadius: 16, transition: 'all 0.3s',
          }}>
            <h3 style={{
              color: '#FFD700', marginBottom: activeStep === 1 ? 16 : 10,
              fontSize: activeStep === 1 ? 34 : 20,
              textShadow: activeStep === 1 ? '0 0 15px rgba(255,215,0,0.4)' : 'none',
              transition: 'all 0.3s',
            }}>
              {lockedEventType ? '1. Event' : activeStep === 1 ? 'CHOOSE YOUR EVENT' : `1. Event: ${eventType}`}
            </h3>
            {activeStep === 1 && !lockedEventType && (
              <p style={{ color: '#aaa', fontSize: 16, marginBottom: 14 }}>Select a race distance to get started</p>
            )}
            {lockedEventType ? (
              <div style={{
                display: 'inline-block', padding: '16px 44px', fontSize: 22, fontWeight: 'bold',
                background: 'linear-gradient(135deg, #FFD700, #ff8800)', color: '#000',
                borderRadius: 10,
              }}>{lockedEventType}</div>
            ) : (
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
                {(['200m', '400m', '800m', '2000mSC'] as EventType[]).map(e => (
                  <button key={e} onClick={() => { setEventType(e); setSelectedAthlete(''); setSelectedBoosts([]); }} style={{
                    padding: activeStep === 1 ? '20px 46px' : '12px 30px',
                    fontSize: activeStep === 1 ? 26 : 18, fontWeight: 'bold',
                    background: eventType === e ? 'linear-gradient(135deg, #FFD700, #ff8800)' : activeStep === 1 ? '#1a1a3e' : '#222',
                    color: eventType === e ? '#000' : activeStep === 1 ? '#FFD700' : '#888',
                    border: eventType === e ? '3px solid #FFD700' : activeStep === 1 ? '2px solid #FFD70055' : '2px solid #444',
                    borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: activeStep === 1 ? '0 0 10px rgba(255,215,0,0.1)' : 'none',
                  }}>
                    {e === '2000mSC' ? '2K SC' : e}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ═══ STEP 2: ATHLETE ═══ */}
          <div style={{
            marginBottom: 28,
            padding: activeStep === 2 ? '24px' : '12px',
            background: activeStep === 2 ? 'rgba(255,215,0,0.08)' : 'transparent',
            border: activeStep === 2 ? '2px solid #FFD70044' : 'none',
            borderRadius: 16, transition: 'all 0.3s',
            opacity: eventType ? 1 : 0.3, pointerEvents: eventType ? 'auto' : 'none',
          }}>
            <h3 style={{
              color: '#FFD700', marginBottom: activeStep === 2 ? 16 : 10,
              fontSize: activeStep === 2 ? 30 : 20, textAlign: 'center',
              textShadow: activeStep === 2 ? '0 0 15px rgba(255,215,0,0.3)' : 'none',
              transition: 'all 0.3s',
            }}>
              {activeStep === 2 ? 'SELECT YOUR ATHLETE' : selectedAthlete ? `2. Athlete: ${athletes.find(a => a.id === selectedAthlete)?.template?.name || '?'}` : '2. Select Athlete'}
            </h3>
            {activeStep === 2 && (
              <p style={{ color: '#aaa', fontSize: 15, marginBottom: 14, textAlign: 'center' }}>Choose who will race the {eventType}</p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
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

          {/* ═══ STEP 3: BOOST ═══ */}
          <div style={{
            marginBottom: 28,
            padding: activeStep === 3 ? '24px' : '12px',
            background: activeStep === 3 ? 'rgba(255,215,0,0.08)' : 'transparent',
            border: activeStep === 3 ? '2px solid #FFD70044' : 'none',
            borderRadius: 16, transition: 'all 0.3s',
            opacity: selectedAthlete ? 1 : 0.3, pointerEvents: selectedAthlete ? 'auto' : 'none',
          }}>
            <h3 style={{
              color: '#FFD700', marginBottom: activeStep === 3 ? 16 : 10,
              fontSize: activeStep === 3 ? 30 : 20, textAlign: 'center',
              textShadow: activeStep === 3 ? '0 0 15px rgba(255,215,0,0.3)' : 'none',
              transition: 'all 0.3s',
            }}>
              {activeStep === 3 ? 'SELECT A BIG IMPACT CARD' : '3. Big Impact Card (Optional)'}
            </h3>
            {activeStep === 3 && (
              <p style={{ color: '#aaa', fontSize: 15, marginBottom: 14, textAlign: 'center' }}>Choose one boost for the race (optional)</p>
            )}
            {boosts.length === 0 ? (
              <p style={{ color: '#666', fontSize: 13, textAlign: 'center' }}>No boosts available. Buy packs to earn boost cards!</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
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
          <div style={{
            textAlign: 'center', paddingTop: 10,
            opacity: canStart ? 1 : 0.3, pointerEvents: canStart ? 'auto' : 'none',
            transition: 'opacity 0.3s',
          }}>
            <button
              onClick={() => eventType && canStart && onStartRace(eventType, selectedAthlete, selectedBoosts)}
              disabled={!canStart}
              style={{
                padding: '22px 90px', fontSize: 30, fontWeight: 'bold',
                background: canStart ? 'linear-gradient(135deg, #ff4444, #cc0000)' : '#333',
                color: canStart ? '#fff' : '#666',
                border: 'none', borderRadius: 14, cursor: canStart ? 'pointer' : 'not-allowed',
                boxShadow: canStart ? '0 0 25px rgba(255,0,0,0.4)' : 'none',
                textTransform: 'uppercase', letterSpacing: 3,
              }}
            >
              START RACE
            </button>
            {canStart && (
              <p style={{ color: '#666', fontSize: 13, marginTop: 8 }}>
                {selectedBoosts.length === 0 ? 'No boost selected — you can race without one' : '1 boost selected'}
              </p>
            )}
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
