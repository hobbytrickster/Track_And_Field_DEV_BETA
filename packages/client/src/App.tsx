import React, { useState, useEffect, useCallback } from 'react';
import { UserAthlete } from '@track-stars/shared';
import { startMenuMusic, stopMenuMusic } from './phaser/utils/music';
import { useAuth } from './hooks/useAuth';
import { api } from './api/client';
import { Login } from './ui/screens/Login';
import { MainMenu } from './ui/screens/MainMenu';
import { Collection } from './ui/screens/Collection';
import { Shop } from './ui/screens/Shop';
import { Boosts } from './ui/screens/Boosts';
import { RaceSetup } from './ui/screens/RaceSetup';
import { RaceView } from './ui/screens/RaceView';
import { History } from './ui/screens/History';
import { Customize } from './ui/screens/Customize';
import { Stadium } from './ui/screens/Stadium';
import { Friends } from './ui/screens/Friends';
import { Challenges } from './ui/screens/Challenges';
import { EventType, RaceSimulationResult } from '@track-stars/shared';

type Screen = 'menu' | 'collection' | 'shop' | 'boosts' | 'race-setup' | 'racing' | 'history' | 'customize' | 'stadium' | 'friends' | 'challenges' | 'challenge-setup' | 'challenge-racing';

function App() {
  const { user, loading, login, register, logout, refreshUser, updateUser } = useAuth();
  const [screen, setScreen] = useState<Screen>('menu');
  const [customizeAthleteId, setCustomizeAthleteId] = useState<string | null>(null);
  const [raceAppearance, setRaceAppearance] = useState<any>(null);
  const [raceStadiumOverride, setRaceStadiumOverride] = useState<any>(null);
  const [challengeFriendId, setChallengeFriendId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [challengeEventType, setChallengeEventType] = useState<string | null>(null);
  const [raceData, setRaceData] = useState<{
    simulation: RaceSimulationResult;
    playerLane: number;
    rewards: { coinsEarned: number; xpEarned: number };
    laneLabels?: Record<number, string>;
    laneMetadata?: Record<number, any>;
  } | null>(null);

  // Menu music: plays on all screens except during a race
  const [musicStarted, setMusicStarted] = useState(false);
  useEffect(() => {
    if (screen === 'racing') {
      stopMenuMusic();
    } else if (user && musicStarted) {
      startMenuMusic();
    }
    return () => {}; // cleanup handled by stopMenuMusic
  }, [screen, user, musicStarted]);

  // Start menu music on first user interaction (browser autoplay policy)
  useEffect(() => {
    const handleClick = () => {
      if (!musicStarted) {
        setMusicStarted(true);
        if (user) startMenuMusic();
      }
    };
    document.addEventListener('click', handleClick, { once: false });
    return () => document.removeEventListener('click', handleClick);
  }, [musicStarted, user]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0d0d0d', color: '#cc2244', fontSize: 24,
      }}>
        Loading Win Big: Track & Field...
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={login} onRegister={register} />;
  }

  const handleStartRace = async (eventType: EventType, athleteId: string, boostIds: string[]) => {
    try {
      // Fetch athlete's appearance for the race
      const athletes = await api.getAthletes();
      const selected = athletes.find((a: any) => a.id === athleteId);
      setRaceAppearance(selected?.appearance || null);

      const result = await api.startRace(eventType, athleteId, boostIds);
      updateUser(result.user);
      setRaceData({
        simulation: result.simulation,
        playerLane: result.playerLane,
        rewards: result.rewards,
      });
      setScreen('racing');
    } catch (err: any) {
      alert('Race error: ' + err.message);
    }
  };

  const handleRaceComplete = () => {
    refreshUser();
    setRaceData(null);
    setRaceStadiumOverride(null);
    setScreen('menu');
  };

  switch (screen) {
    case 'collection':
      return <Collection
        onBack={() => setScreen('menu')}
        onCustomize={(athleteId: string) => { setCustomizeAthleteId(athleteId); setScreen('customize'); }}
      />;

    case 'shop':
      return (
        <Shop
          coins={user.coins}
          onCoinsUpdate={coins => updateUser({ coins })}
          onBack={() => setScreen('menu')}
        />
      );

    case 'boosts':
      return <Boosts onBack={() => setScreen('menu')} />;

    case 'race-setup':
      return (
        <RaceSetup
          onStartRace={handleStartRace}
          onBack={() => setScreen('menu')}
        />
      );

    case 'racing':
      if (!raceData) return null;
      return (
        <RaceView
          simulation={raceData.simulation}
          playerLane={raceData.playerLane}
          rewards={raceData.rewards}
          playerAppearance={raceAppearance}
          stadiumConfig={raceStadiumOverride || user.stadium}
          laneLabels={raceData.laneLabels}
          laneMetadata={raceData.laneMetadata}
          onComplete={handleRaceComplete}
        />
      );

    case 'history':
      return <History onBack={() => setScreen('menu')} />;

    case 'friends':
      return <Friends
        onBack={() => setScreen('menu')}
        onChallenge={(fid) => { setChallengeFriendId(fid); setScreen('challenge-setup'); }}
        onAcceptChallenge={(cid, evt) => { setChallengeId(cid); setChallengeEventType(evt); setScreen('challenge-setup'); }}
        onViewResult={async (cid) => {
          try {
            const data = await api.getChallengeResult(cid);
            if (data.simulation) {
              setRaceData({
                simulation: data.simulation, playerLane: data.playerLane,
                rewards: { coinsEarned: 0, xpEarned: 0 },
                laneLabels: data.laneLabels, laneMetadata: data.laneMetadata,
              });
              setRaceStadiumOverride(data.stadiumConfig || null);
              setScreen('racing');
            }
          } catch (err: any) { alert(err.message); }
        }}
      />;

    case 'challenge-setup':
      return <RaceSetup
        lockedEventType={challengeEventType ? challengeEventType as EventType : undefined}
        onStartRace={async (eventType, athleteId, boostIds) => {
          try {
            const athletes = await api.getAthletes();
            const selected = athletes.find((a: any) => a.id === athleteId);
            setRaceAppearance(selected?.appearance || null);

            if (challengeId) {
              // Accepting an existing challenge
              const result = await api.submitChallenge(challengeId, athleteId, boostIds);
              if (result.status === 'simulated') {
                const data = await api.getChallengeResult(challengeId);
                setRaceData({
                  simulation: data.simulation, playerLane: data.playerLane,
                  rewards: { coinsEarned: 0, xpEarned: 0 },
                  laneLabels: data.laneLabels, laneMetadata: data.laneMetadata,
                });
                setRaceStadiumOverride(data.stadiumConfig || null);
                setChallengeId(null); setChallengeEventType(null); setChallengeFriendId(null);
                setScreen('racing');
              } else {
                alert('Challenge submitted! Waiting for opponent to respond.');
                setChallengeId(null); setChallengeEventType(null); setChallengeFriendId(null);
                setScreen('challenges');
              }
            } else if (challengeFriendId) {
              // Creating a new challenge
              await api.createChallenge(challengeFriendId, eventType, athleteId, boostIds);
              alert('Challenge sent! Your friend will see it next time they log in.');
              setChallengeFriendId(null);
              setScreen('friends');
            }
          } catch (err: any) { alert(err.message); }
        }}
        onBack={() => { setChallengeId(null); setChallengeEventType(null); setChallengeFriendId(null); setScreen(challengeId ? 'challenges' : 'friends'); }}
      />;

    case 'stadium':
      return (
        <Stadium
          currentStadium={(user as any).stadium || null}
          onSave={(stadium) => { updateUser({ stadium } as any); setScreen('menu'); }}
          onBack={() => setScreen('menu')}
        />
      );

    case 'customize':
      return (
        <CustomizeLoader
          athleteId={customizeAthleteId}
          onSave={() => setScreen('collection')}
          onBack={() => setScreen('collection')}
        />
      );

    default:
      return (
        <MainMenu
          user={user}
          onNavigate={s => setScreen(s as Screen)}
          onLogout={logout}
        />
      );
  }
}

function CustomizeLoader({ athleteId, onSave, onBack }: { athleteId: string | null; onSave: () => void; onBack: () => void }) {
  const [athlete, setAthlete] = useState<UserAthlete | null>(null);
  useEffect(() => {
    if (!athleteId) return;
    api.getAthletes().then((athletes: UserAthlete[]) => {
      const found = athletes.find((a: UserAthlete) => a.id === athleteId);
      if (found) setAthlete(found);
    });
  }, [athleteId]);
  if (!athlete) return <div style={{ minHeight: '100vh', background: '#0a0a1a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  return <Customize athlete={athlete} onSave={onSave} onBack={onBack} />;
}

export default App;
