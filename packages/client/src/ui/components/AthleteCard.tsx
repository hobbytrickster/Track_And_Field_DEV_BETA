import React, { useRef, useEffect } from 'react';
import { UserAthlete } from '@track-stars/shared';

interface Props {
  athlete: UserAthlete;
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

function formatSplitType(st: string): { label: string; color: string } {
  switch (st) {
    case 'extreme_positive': return { label: 'EXTREME FRONT RUNNER', color: '#ff4444' };
    case 'positive': return { label: 'FRONT RUNNER', color: '#ff8844' };
    case 'negative': return { label: 'CLOSER', color: '#44aaff' };
    case 'extreme_negative': return { label: 'EXTREME CLOSER', color: '#aa44ff' };
    default: return { label: 'EVEN PACER', color: '#44ddaa' };
  }
}

const RARITY_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  diamond: '#B9F2FF',
  superstar: '#aa44ff',
};

const RARITY_BG: Record<string, string> = {
  bronze: 'linear-gradient(135deg, #8B4513, #CD7F32)',
  silver: 'linear-gradient(135deg, #606060, #C0C0C0)',
  gold: 'linear-gradient(135deg, #B8860B, #FFD700)',
  platinum: 'linear-gradient(135deg, #666680, #E5E4E2)',
  diamond: 'linear-gradient(135deg, #0088aa, #B9F2FF)',
  superstar: 'linear-gradient(135deg, #6600aa, #aa44ff, #cc66ff, #aa44ff)',
};

export function AthleteCard({ athlete, selected, onClick, compact }: Props) {
  const t = athlete.template;
  if (!t) return null;

  const displayName = (athlete as any).appearance?.customName || t.name;

  if (compact) {
    return (
      <div onClick={onClick} style={{
        background: RARITY_BG[t.rarity],
        border: selected ? '3px solid #FFD700' : '2px solid #333',
        borderRadius: 12, padding: '12px', cursor: onClick ? 'pointer' : 'default',
        width: 180, textAlign: 'center', transition: 'transform 0.15s',
        transform: selected ? 'scale(1.05)' : 'scale(1)',
      }}>
        <div style={{ fontSize: 15, color: '#fff', fontWeight: 'bold' }}>{displayName}</div>
        <MiniRunner appearance={(athlete as any).appearance} jerseyFallback={RARITY_COLORS[t.rarity] || '#ff4444'} />
        <div style={{ fontSize: 34, fontWeight: 'bold', color: '#fff', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
          {t.overallRating}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{t.specialtyEvent}</div>
        {t.splitType && (() => { const st = formatSplitType(t.splitType); return (
          <div style={{
            fontSize: 12, fontWeight: 'bold', color: st.color, marginTop: 4,
            background: 'rgba(0,0,0,0.4)', padding: '3px 10px', borderRadius: 6,
            border: `1px solid ${st.color}44`, letterSpacing: 0.5,
          }}>{st.label}</div>
        ); })()}
      </div>
    );
  }

  return (
    <div onClick={onClick} style={{
      background: RARITY_BG[t.rarity],
      border: selected ? '3px solid #FFD700' : '2px solid #444',
      borderRadius: 14, padding: '16px', cursor: onClick ? 'pointer' : 'default',
      width: 240, transition: 'transform 0.15s',
      transform: selected ? 'scale(1.05)' : 'scale(1)',
      boxShadow: selected ? '0 0 20px rgba(255,215,0,0.5)' : '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>{t.rarity}</span>
        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{t.nationality}</span>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 19, fontWeight: 'bold', color: '#fff' }}>{displayName}</div>
        <MiniRunner appearance={(athlete as any).appearance} jerseyFallback={RARITY_COLORS[t.rarity] || '#ff4444'} />
        <div style={{ fontSize: 48, fontWeight: 'bold', color: '#fff', textShadow: '2px 2px 6px rgba(0,0,0,0.5)', lineHeight: 1.1 }}>
          {t.overallRating}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>OVERALL RATING</div>
      </div>

      <div style={{ fontSize: 15, color: '#FFD700', textAlign: 'center', marginBottom: 4 }}>
        {t.specialtyEvent} Specialist
      </div>
      {t.splitType && (() => { const st = formatSplitType(t.splitType); return (
        <div style={{
          fontSize: 15, fontWeight: 'bold', color: st.color, textAlign: 'center', marginBottom: 8,
          background: 'rgba(0,0,0,0.35)', padding: '5px 12px', borderRadius: 8,
          border: `1px solid ${st.color}55`, letterSpacing: 0.5,
        }}>{st.label}</div>
      ); })()}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, fontSize: 14 }}>
        <StatBar label="SPD" value={t.stats.speed} />
        <StatBar label="STA" value={t.stats.stamina} />
        <StatBar label="ACC" value={t.stats.acceleration} />
        <StatBar label="FRM" value={t.stats.form} />
      </div>

      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', marginTop: 6, textAlign: 'center' }}>
        {t.flavorText}
      </div>
    </div>
  );
}

function StatBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, value);
  const color = pct >= 80 ? '#44ff44' : pct >= 60 ? '#FFD700' : pct >= 40 ? '#ff8800' : '#ff4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: 'rgba(255,255,255,0.7)', width: 28 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.3)', borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ color: '#fff', fontWeight: 'bold', width: 22, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

const SKIN_COLORS: Record<number, string> = {
  0: '#f5cba7', 1: '#f0b088', 2: '#e0ac69', 3: '#c68642', 4: '#8d5524', 5: '#4a2c0a',
};
const HAIR_DEFAULTS = '#222222';

function MiniRunner({ appearance, jerseyFallback }: { appearance?: any; jerseyFallback: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const w = c.width, h = c.height;
    ctx.clearRect(0, 0, w, h);

    const pa = appearance;
    const skin = pa ? (SKIN_COLORS[pa.skinTone] || '#f5cba7') : '#e0ac69';
    const jersey = pa ? `#${(pa.jerseyColor || 0xff4444).toString(16).padStart(6, '0')}` : jerseyFallback;
    const shorts = pa ? `#${(pa.shortsColor || 0x222244).toString(16).padStart(6, '0')}` : '#222244';
    const shoes = pa ? `#${(pa.shoeColor || 0x222222).toString(16).padStart(6, '0')}` : '#222222';
    const hair = pa ? `#${(pa.hairColor || 0x222222).toString(16).padStart(6, '0')}` : HAIR_DEFAULTS;

    const cx = w / 2, by = h * 0.85, s = 1.8;
    const headY = by - 18 * s;
    const torsoTop = headY + 4 * s;

    // Legs
    ctx.strokeStyle = skin; ctx.lineWidth = 2 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 2 * s, torsoTop + 10 * s); ctx.lineTo(cx - 4 * s, by); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 2 * s, torsoTop + 10 * s); ctx.lineTo(cx + 4 * s, by); ctx.stroke();

    // Shorts
    ctx.fillStyle = shorts;
    ctx.fillRect(cx - 4 * s, torsoTop + 9 * s, 8 * s, 4 * s);

    // Shoes
    ctx.fillStyle = shoes;
    ctx.beginPath(); ctx.arc(cx - 4 * s, by, 2 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 4 * s, by, 2 * s, 0, Math.PI * 2); ctx.fill();

    // Torso
    ctx.fillStyle = jersey;
    ctx.beginPath();
    ctx.roundRect(cx - 4 * s, torsoTop, 8 * s, 10 * s, 2 * s);
    ctx.fill();

    // Arms
    ctx.strokeStyle = skin; ctx.lineWidth = 1.5 * s;
    ctx.beginPath(); ctx.moveTo(cx - 4 * s, torsoTop + 2 * s); ctx.lineTo(cx - 8 * s, torsoTop + 10 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 4 * s, torsoTop + 2 * s); ctx.lineTo(cx + 8 * s, torsoTop + 10 * s); ctx.stroke();

    // Head
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(cx, headY, 4.5 * s, 0, Math.PI * 2); ctx.fill();

    // Hair
    ctx.fillStyle = hair;
    const hs = pa?.hairStyle ?? 0;
    if (hs === 2) { // Afro
      ctx.beginPath(); ctx.arc(cx, headY - 1.5 * s, 6 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(cx, headY, 4.5 * s, 0, Math.PI * 2); ctx.fill();
    } else if (hs === 4) { // Mohawk
      ctx.fillRect(cx - 1.5 * s, headY - 8 * s, 3 * s, 6 * s);
    } else {
      ctx.beginPath(); ctx.ellipse(cx, headY - 1.5 * s, 4.5 * s, 3 * s, 0, Math.PI, 0); ctx.fill();
    }
  }, [appearance, jerseyFallback]);

  return <canvas ref={ref} width={50} height={70} style={{ display: 'block', margin: '4px auto' }} />;
}
