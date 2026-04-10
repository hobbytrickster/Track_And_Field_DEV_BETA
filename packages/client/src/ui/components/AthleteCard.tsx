import React, { useRef, useEffect } from 'react';
import { UserAthlete } from '@track-stars/shared';

// Inject superstar shimmer animation once
if (typeof document !== 'undefined' && !document.getElementById('ss-card-shimmer')) {
  const style = document.createElement('style');
  style.id = 'ss-card-shimmer';
  style.textContent = `
    @keyframes ssCardShimmer {
      0% { background-position: 100% 50%; }
      50% { background-position: 0% 50%; }
      100% { background-position: 100% 50%; }
    }
  `;
  document.head.appendChild(style);
}

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
  legend: '#ff8800',
};

const RARITY_BG: Record<string, string> = {
  bronze: 'linear-gradient(135deg, #8B4513, #CD7F32)',
  silver: 'linear-gradient(135deg, #606060, #C0C0C0)',
  gold: 'linear-gradient(135deg, #B8860B, #FFD700)',
  platinum: 'linear-gradient(135deg, #666680, #E5E4E2)',
  diamond: 'linear-gradient(135deg, #0088aa, #B9F2FF)',
  superstar: 'linear-gradient(135deg, #6600aa, #aa44ff, #cc66ff, #aa44ff)',
  legend: 'linear-gradient(135deg, #cc4400, #ff8800, #ffcc44, #ff8800)',
};

export function AthleteCard({ athlete, selected, onClick, compact }: Props) {
  const t = athlete.template;
  if (!t) return null;

  const displayName = (athlete as any).appearance?.customName || t.name;
  const isSS = t.rarity === 'superstar';
  const isLegend = t.rarity === 'legend';
  const isShimmer = isSS || isLegend;

  // Performance boost calculations
  const appliedBoosts = (athlete as any).appliedPerfBoosts || [];
  const perfBoostTotals = { speed: 0, stamina: 0, acceleration: 0, form: 0 };
  for (const pb of appliedBoosts) {
    if (pb?.statBoosts) {
      perfBoostTotals.speed += pb.statBoosts.speed || 0;
      perfBoostTotals.stamina += pb.statBoosts.stamina || 0;
      perfBoostTotals.acceleration += pb.statBoosts.acceleration || 0;
      perfBoostTotals.form += pb.statBoosts.form || 0;
    }
  }
  const hasPerfBoosts = perfBoostTotals.speed + perfBoostTotals.stamina + perfBoostTotals.acceleration + perfBoostTotals.form > 0;
  const boostedOVR = hasPerfBoosts
    ? Math.round((t.stats.speed + perfBoostTotals.speed) * 0.35 + (t.stats.stamina + perfBoostTotals.stamina) * 0.25 + (t.stats.acceleration + perfBoostTotals.acceleration) * 0.25 + (t.stats.form + perfBoostTotals.form) * 0.15)
    : t.overallRating;

  if (compact) {
    return (
      <div onClick={onClick} style={{
        background: isLegend
          ? 'linear-gradient(135deg, #cc4400 0%, #ee6600 20%, #ffaa33 40%, #ffdd66 50%, #ffaa33 60%, #ee6600 80%, #cc4400 100%)'
          : isSS
          ? 'linear-gradient(135deg, #6600aa 0%, #8833cc 20%, #cc77ff 40%, #dd99ff 50%, #cc77ff 60%, #8833cc 80%, #6600aa 100%)'
          : RARITY_BG[t.rarity],
        backgroundSize: isShimmer ? '300% 100%' : undefined,
        animation: isShimmer ? 'ssCardShimmer 8s ease-in-out infinite' : undefined,
        border: selected ? '3px solid #FFD700' : isLegend ? '2px solid #ffaa33' : isSS ? '2px solid #cc66ff' : '2px solid #333',
        borderRadius: 12, padding: '12px', cursor: onClick ? 'pointer' : 'default',
        width: 195, height: 250, textAlign: 'center', transition: 'transform 0.15s',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: 8,
        overflow: 'hidden', gap: 1,
        transform: selected ? 'scale(1.05)' : 'scale(1)',
        boxShadow: isLegend ? '0 0 12px rgba(255,136,0,0.5)' : isSS ? '0 0 12px rgba(170,68,255,0.4)' : undefined,
      }}>
        <div style={{ fontSize: 15, color: '#fff', fontWeight: 'bold', lineHeight: 1.2 }}>{displayName}</div>
        <MiniRunner appearance={(athlete as any).appearance} jerseyFallback={RARITY_COLORS[t.rarity] || '#ff4444'} />
        <div style={{ fontSize: 30, fontWeight: 'bold', color: hasPerfBoosts ? '#00ff88' : '#fff', textShadow: '2px 2px 4px rgba(0,0,0,0.5)', lineHeight: 1 }}>
          {boostedOVR}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: 'bold' }}>{t.specialtyEvent}</div>
        {t.splitType && (() => { const st = formatSplitType(t.splitType); return (
          <div style={{
            fontSize: 10, fontWeight: 'bold', color: st.color, marginTop: 2,
            background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: 5,
            border: `1px solid ${st.color}44`, letterSpacing: 0.5,
          }}>{st.label}</div>
        ); })()}
        {appliedBoosts.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 3 }}>
            {appliedBoosts.map((pb: any, i: number) => (
              <div key={i} style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(0,0,0,0.65)',
                border: `2px solid ${pb.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, boxShadow: `0 0 8px ${pb.color}88`,
              }}>{pb.iconKey}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div onClick={onClick} style={{
      background: isLegend
        ? 'linear-gradient(135deg, #cc4400 0%, #ee6600 20%, #ffaa33 40%, #ffdd66 50%, #ffaa33 60%, #ee6600 80%, #cc4400 100%)'
        : isSS
        ? 'linear-gradient(135deg, #6600aa 0%, #8833cc 20%, #cc77ff 40%, #dd99ff 50%, #cc77ff 60%, #8833cc 80%, #6600aa 100%)'
        : RARITY_BG[t.rarity],
      backgroundSize: isShimmer ? '300% 100%' : undefined,
      animation: isShimmer ? 'ssCardShimmer 8s ease-in-out infinite' : undefined,
      border: selected ? '3px solid #FFD700' : isLegend ? '2px solid #ffaa33' : isSS ? '2px solid #cc66ff' : '2px solid #444',
      borderRadius: 14, padding: '20px', cursor: onClick ? 'pointer' : 'default',
      width: 380, height: 650, overflow: 'hidden', transition: 'transform 0.15s',
      display: 'flex', flexDirection: 'column' as const,
      transform: selected ? 'scale(1.05)' : 'scale(1)',
      boxShadow: isLegend ? '0 0 15px rgba(255,136,0,0.6)' : isSS ? '0 0 15px rgba(170,68,255,0.5)' : selected ? '0 0 20px rgba(255,215,0,0.5)' : '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', fontWeight: 'bold' }}>{t.rarity}</span>
        <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)' }}>{t.nationality}</span>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 'bold', color: '#fff' }}>{displayName}</div>
        <MiniRunner appearance={(athlete as any).appearance} jerseyFallback={RARITY_COLORS[t.rarity] || '#ff4444'} large />
        <div style={{ fontSize: 52, fontWeight: 'bold', color: hasPerfBoosts ? '#00ff88' : '#fff', textShadow: '2px 2px 6px rgba(0,0,0,0.5)', lineHeight: 1.1 }}>
          {boostedOVR}
        </div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)' }}>OVERALL RATING</div>
      </div>

      <div style={{ fontSize: 17, color: '#FFD700', textAlign: 'center', marginBottom: 6, fontWeight: 'bold' }}>
        {t.specialtyEvent} Specialist
      </div>
      {t.splitType && (() => { const st = formatSplitType(t.splitType); return (
        <div style={{
          fontSize: 16, fontWeight: 'bold', color: st.color, textAlign: 'center', marginBottom: 10,
          background: 'rgba(0,0,0,0.7)', padding: '6px 14px', borderRadius: 8,
          border: `1px solid ${st.color}55`, letterSpacing: 0.5,
        }}>{st.label}</div>
      ); })()}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 16 }}>
        <StatBar label="SPD" value={t.stats.speed} boost={perfBoostTotals.speed} />
        <StatBar label="STA" value={t.stats.stamina} boost={perfBoostTotals.stamina} />
        <StatBar label="ACC" value={t.stats.acceleration} boost={perfBoostTotals.acceleration} />
        <StatBar label="FRM" value={t.stats.form} boost={perfBoostTotals.form} />
      </div>

      {/* Applied performance boost circles */}
      {appliedBoosts.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 10 }}>
          {appliedBoosts.map((pb: any, i: number) => (
            <div key={i} title={`${pb.name}: +${pb.statBoosts.speed}SPD +${pb.statBoosts.stamina}STA +${pb.statBoosts.acceleration}ACC +${pb.statBoosts.form}FRM`}
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: `radial-gradient(circle, ${pb.color}88, ${pb.color}44)`,
                border: `2px solid ${pb.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
              }}>{pb.iconKey}</div>
          ))}
          {/* Empty slots */}
          {Array.from({ length: 3 - appliedBoosts.length }).map((_, i) => (
            <div key={`empty-${i}`} style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(0,0,0,0.3)', border: '2px dashed rgba(255,255,255,0.2)',
            }} />
          ))}
        </div>
      )}

      <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', marginTop: 10, textAlign: 'center' }}>
        {t.flavorText}
      </div>
    </div>
  );
}

function StatBar({ label, value, boost }: { label: string; value: number; boost?: number }) {
  const basePct = Math.min(100, value);
  const boostPct = boost ? Math.min(100 - basePct, (boost / 100) * 100) : 0;
  const color = basePct >= 80 ? '#44ff44' : basePct >= 60 ? '#FFD700' : basePct >= 40 ? '#ff8800' : '#ff4444';
  const total = value + (boost || 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: 'rgba(255,255,255,0.7)', width: 28 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: 'rgba(0,0,0,0.3)', borderRadius: 3, position: 'relative' }}>
        <div style={{ width: `${basePct}%`, height: '100%', background: color, borderRadius: 3 }} />
        {boostPct > 0 && (
          <div style={{ position: 'absolute', left: `${basePct}%`, top: 0, width: `${boostPct}%`, height: '100%', background: '#00ff88', borderRadius: '0 3px 3px 0' }} />
        )}
      </div>
      <span style={{ color: boost ? '#00ff88' : '#fff', fontWeight: 'bold', width: 22, textAlign: 'right' }}>{total}</span>
    </div>
  );
}

const SKIN_COLORS: Record<number, string> = {
  0: '#f5cba7', 1: '#f0b088', 2: '#e0ac69', 3: '#c68642', 4: '#8d5524', 5: '#4a2c0a',
};
const HAIR_DEFAULTS = '#222222';

function MiniRunner({ appearance, jerseyFallback, large }: { appearance?: any; jerseyFallback: string; large?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const canvasW = large ? 200 : 75;
  const canvasH = large ? 250 : 100;
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

    const cx = w / 2, by = h * 0.85, s = large ? 7.0 : 2.2;
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

    // Face — eyes and mouth
    const eyeY = headY - 0.5 * s;
    const eyeSpacing = 2 * s;
    // Eyes (small dark circles)
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(cx - eyeSpacing, eyeY, 0.8 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + eyeSpacing, eyeY, 0.8 * s, 0, Math.PI * 2); ctx.fill();
    // Eye whites (tiny highlights)
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx - eyeSpacing + 0.3 * s, eyeY - 0.3 * s, 0.3 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + eyeSpacing + 0.3 * s, eyeY - 0.3 * s, 0.3 * s, 0, Math.PI * 2); ctx.fill();
    // Mouth (small arc)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.6 * s;
    ctx.beginPath(); ctx.arc(cx, headY + 1.8 * s, 1.5 * s, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
  }, [appearance, jerseyFallback]);

  return <canvas ref={ref} width={canvasW} height={canvasH} style={{ display: 'block', margin: large ? '8px auto' : '4px auto' }} />;
}
