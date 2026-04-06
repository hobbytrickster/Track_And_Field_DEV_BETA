import React from 'react';
import { UserBoost } from '@track-stars/shared';

interface Props {
  boost: UserBoost;
  selected?: boolean;
  onClick?: () => void;
}

const RARITY_GLOW: Record<string, string> = {
  bronze: 'rgba(205,127,50,0.3)',
  silver: 'rgba(192,192,192,0.3)',
  gold: 'rgba(255,215,0,0.4)',
  platinum: 'rgba(229,228,226,0.4)',
  diamond: 'rgba(185,242,255,0.5)',
};

export function BoostCard({ boost, selected, onClick }: Props) {
  const t = boost.template;
  if (!t) return null;

  return (
    <div onClick={onClick} style={{
      background: `linear-gradient(135deg, ${t.color}33, ${t.color}11)`,
      border: selected ? `3px solid ${t.color}` : '2px solid #333',
      borderRadius: 14,
      padding: '14px',
      cursor: onClick ? 'pointer' : 'default',
      width: 200,
      transition: 'transform 0.15s',
      transform: selected ? 'scale(1.05)' : 'scale(1)',
      boxShadow: selected ? `0 0 15px ${t.color}66` : 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{
          fontSize: 13, color: t.color, textTransform: 'uppercase', fontWeight: 'bold',
        }}>{t.rarity}</span>
        <span style={{
          fontSize: 13, color: '#aaa', background: '#222', padding: '2px 8px', borderRadius: 8,
        }}>x{boost.quantity}</span>
      </div>

      <div style={{
        fontSize: 36, textAlign: 'center', marginBottom: 6,
        filter: `drop-shadow(0 0 8px ${t.color})`,
      }}>
        {t.effectType === 'speed_burst' ? '⚡' :
         t.effectType === 'perfect_start' ? '🚀' :
         t.effectType === 'second_wind' ? '💨' :
         t.effectType === 'adrenaline_rush' ? '🔥' :
         t.effectType === 'intimidate' ? '😤' :
         t.effectType === 'draft_surge' ? '🌊' :
         t.effectType === 'iron_legs' ? '🦿' :
         t.effectType === 'crowd_favorite' ? '👑' : '⭐'}
      </div>

      <div style={{ fontSize: 16, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 6 }}>
        {t.name}
      </div>

      <div style={{ fontSize: 13, color: '#bbb', textAlign: 'center', lineHeight: 1.3 }}>
        {t.description}
      </div>

      <div style={{
        fontSize: 13, color: t.color, textAlign: 'center', marginTop: 8, fontWeight: 'bold',
      }}>
        +{Math.round(t.effectMagnitude * 100)}% | {Math.round(t.durationPct * 100)}% of race
      </div>
    </div>
  );
}
