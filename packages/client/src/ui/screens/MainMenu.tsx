import React from 'react';
import { useAudioMute } from '../../hooks/useAudioMute';

interface Props {
  user: { displayName: string; coins: number; level: number; xp: number; wins: number; losses: number };
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

export function MainMenu({ user, onNavigate, onLogout }: Props) {
  const { muted, toggle: toggleMute } = useAudioMute();

  // Inject shimmer animation
  React.useEffect(() => {
    if (document.getElementById('shimmer-style')) return;
    const style = document.createElement('style');
    style.id = 'shimmer-style';
    style.textContent = `
      @keyframes shimmer {
        0% { background-position: 100% 50%; }
        50% { background-position: 0% 50%; }
        100% { background-position: 100% 50%; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #1a0a0a, #0d0d0d, #1a0a0a)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 28px', borderBottom: '1px solid #ffffff12',
        background: 'rgba(0,0,0,0.5)',
      }}>
        <h1 style={{
          fontSize: 34, fontWeight: 900, margin: 0, letterSpacing: 1,
          fontFamily: '"Trebuchet MS", "Lucida Grande", sans-serif',
          background: 'linear-gradient(135deg, #cc2244, #ff4466)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>WIN BIG: TRACK & FIELD</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 17, fontWeight: 'bold', color: '#fff', fontFamily: '"Georgia", serif' }}>{user.displayName}</div>
            <div style={{ fontSize: 12, color: '#888' }}>Level {user.level} | {user.wins}W - {user.losses}L</div>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #cc2244, #991133)', padding: '9px 18px',
            borderRadius: 20, fontWeight: 'bold', color: '#fff', fontSize: 15,
          }}>
            {user.coins} coins
          </div>
          <button onClick={toggleMute} style={{
            background: muted ? '#cc2244' : '#333', border: '1px solid #555', color: '#fff',
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 16,
          }}>{muted ? '🔇' : '🔊'}</button>
          <button onClick={onLogout} style={{
            background: 'none', border: '1px solid #444', color: '#888',
            padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
          }}>Logout</button>
        </div>
      </div>

      {/* Menu buttons */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        gap: 8, padding: '14px 28px', maxWidth: 960, width: '100%',
        margin: '0 auto',
      }}>
        <MenuRow
          title="RACE"
          subtitle="Choose your event and compete"
          bg="linear-gradient(135deg, #cc2244, #881122)"
          borderColor="#ff3355"
          glow="rgba(204,34,68,0.35)"
          flex={1.8}
          onClick={() => onNavigate('race-setup')}
        />
        <MenuRow
          title="MY TEAM"
          subtitle="View and manage your athletes"
          bg="linear-gradient(135deg, #1a2a3a, #0d1520)"
          borderColor="#2a5a8a"
          accentColor="#4499dd"
          onClick={() => onNavigate('collection')}
        />
        <MenuRow
          title="SHOP"
          subtitle="Buy card packs to build your squad"
          bg="linear-gradient(135deg, #1a2a1a, #0d1a0d)"
          borderColor="#2a6a2a"
          accentColor="#44bb44"
          onClick={() => onNavigate('shop')}
        />
        <MenuRow
          title="BOOSTS"
          subtitle="View your Big Impact cards"
          bg="linear-gradient(135deg, #2a1a0a, #1a100a)"
          borderColor="#8a5a2a"
          accentColor="#ddaa44"
          onClick={() => onNavigate('boosts')}
        />
        <MenuRow
          title="FRIENDS"
          subtitle="Add friends, challenge them to race"
          bg="linear-gradient(135deg, #2a1a2a, #1a0d1a)"
          borderColor="#8a2a6a"
          accentColor="#cc66aa"
          onClick={() => onNavigate('friends')}
        />
        <MenuRow
          title="STADIUM"
          subtitle="Customize your home stadium"
          bg="linear-gradient(135deg, #2a1a2a, #1a0d1a)"
          borderColor="#6a2a6a"
          accentColor="#bb66cc"
          onClick={() => onNavigate('stadium')}
        />
        <MenuRow
          title="RACE HISTORY"
          subtitle="View your past results"
          bg="linear-gradient(135deg, #1a1a1a, #0d0d0d)"
          borderColor="#444"
          accentColor="#999"
          onClick={() => onNavigate('history')}
        />
      </div>
    </div>
  );
}

function MenuRow({ title, subtitle, bg, borderColor, accentColor, glow, flex, onClick }: {
  title: string; subtitle: string; bg: string; borderColor: string;
  accentColor?: string; glow?: string; flex?: number; onClick: () => void;
}) {
  const isPrimary = !!glow;

  return (
    <div onClick={onClick} style={{
      flex: flex || 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: bg,
      border: `${isPrimary ? 2 : 1}px solid ${borderColor}`,
      borderRadius: 14, padding: '12px 32px', cursor: 'pointer',
      transition: 'transform 0.15s, border-color 0.15s, box-shadow 0.15s',
      boxShadow: glow ? `0 4px 24px ${glow}` : 'none',
      minHeight: isPrimary ? 80 : 0,
    }}
    onMouseEnter={e => {
      const el = e.currentTarget as HTMLElement;
      el.style.transform = 'scale(1.02)';
      el.style.borderColor = accentColor || '#ff6688';
      el.style.boxShadow = glow || `0 2px 16px ${accentColor || '#fff'}22`;
    }}
    onMouseLeave={e => {
      const el = e.currentTarget as HTMLElement;
      el.style.transform = 'scale(1)';
      el.style.borderColor = borderColor;
      el.style.boxShadow = glow || 'none';
    }}>
      <div style={{ textAlign: 'center' }}>
        {isPrimary ? (
          <div style={{
            fontSize: 56,
            fontWeight: 900,
            letterSpacing: 10,
            textTransform: 'uppercase',
            fontFamily: '"Trebuchet MS", "Lucida Grande", sans-serif',
            background: 'linear-gradient(90deg, #fff, #ffd700, #fff, #ff8800, #fff)',
            backgroundSize: '300% 100%',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'shimmer 3s ease-in-out infinite',
            textShadow: 'none',
            filter: 'drop-shadow(0 2px 6px rgba(255,215,0,0.4))',
          }}>{title}</div>
        ) : (
          <div style={{
            fontSize: 28,
            fontWeight: 900,
            color: '#fff',
            letterSpacing: 2,
            textTransform: 'uppercase',
            fontFamily: '"Trebuchet MS", "Lucida Grande", sans-serif',
          }}>{title}</div>
        )}
        <div style={{
          fontSize: isPrimary ? 16 : 14,
          color: accentColor || '#bbb',
          marginTop: 3,
          fontFamily: '"Trebuchet MS", "Lucida Grande", sans-serif',
          letterSpacing: 0.5,
        }}>{subtitle}</div>
      </div>
    </div>
  );
}
