import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../api/client';
import { UserAthlete } from '@track-stars/shared';

export interface Appearance {
  skinTone: number;
  hairStyle: number;
  hairColor: number;
  jerseyColor: number;
  shortsColor: number;
  shoeColor: number;
  accessory: number;
}

export const DEFAULT_APPEARANCE: Appearance = {
  skinTone: 0,
  hairStyle: 0,
  hairColor: 0x222222,
  jerseyColor: 0xff4444,
  shortsColor: 0x222244,
  shoeColor: 0x222222,
  accessory: 0,
};

const SKIN_TONES = [
  { color: 0xf5cba7, label: 'Light' },
  { color: 0xf0b088, label: 'Fair' },
  { color: 0xe0ac69, label: 'Medium' },
  { color: 0xc68642, label: 'Tan' },
  { color: 0x8d5524, label: 'Brown' },
  { color: 0x4a2c0a, label: 'Dark' },
];

const HAIR_COLORS = [
  { color: 0x222222, label: 'Black' },
  { color: 0x4a3000, label: 'Dark Brown' },
  { color: 0x8B4513, label: 'Brown' },
  { color: 0xDAA520, label: 'Blonde' },
  { color: 0xCC3300, label: 'Red' },
  { color: 0x888888, label: 'Gray' },
  { color: 0xffffff, label: 'White' },
  { color: 0x0044ff, label: 'Blue' },
  { color: 0xff00ff, label: 'Pink' },
  { color: 0x00cc00, label: 'Green' },
];

const HAIR_STYLES = ['Short Crop', 'Bald', 'Afro', null, 'Mohawk', 'Long']; // null = removed (Spiky)

const JERSEY_COLORS = [
  0xff4444, 0x4488ff, 0x44cc44, 0xffaa00, 0xff44ff,
  0x00ddaa, 0xdddd22, 0xaa44ff, 0xff8844, 0x2244aa,
  0xcc0000, 0x000000, 0xffffff, 0x884400, 0x008888,
];

const SHORTS_COLORS = [
  0x222244, 0x000000, 0x222222, 0x444444, 0x002244,
  0x442200, 0xffffff, 0x880000, 0x004400, 0x440044,
];

const SHOE_COLORS = [
  0x222222, 0xffffff, 0xff0000, 0x0044ff, 0x00cc00,
  0xffaa00, 0xff44ff, 0x888888, 0x000000, 0xFFD700,
];

const ACCESSORIES = ['None', 'Headband', 'Sunglasses', 'Wristbands'];

interface Props {
  athlete: UserAthlete;
  onSave: () => void;
  onBack: () => void;
}

const BANNED_WORDS = ['fuck','shit','ass','bitch','damn','dick','cock','pussy','cunt','nigger','nigga','fag','faggot','retard','whore','slut'];

function hasProfanity(name: string): boolean {
  const lower = name.toLowerCase().replace(/[^a-z]/g, '');
  return BANNED_WORDS.some(w => lower.includes(w));
}

export function Customize({ athlete, onSave, onBack }: Props) {
  const [app, setApp] = useState<Appearance>((athlete as any).appearance || DEFAULT_APPEARANCE);
  const [athleteName, setAthleteName] = useState(athlete.template?.name || '');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { drawPreview(); }, [app]);

  const drawPreview = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const baseY = h * 0.78;
    const s = 3.5;
    const skinColor = SKIN_TONES[app.skinTone]?.color ?? 0xf5cba7;
    const toCSS = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

    const headY = baseY - 22 * s;
    const torsoTop = headY + 6 * s;
    const torsoBot = torsoTop + 12 * s;
    const hipY = torsoBot;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(cx, baseY + 6 * s, 10 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();

    // Legs (extend down to shoe position)
    const footY = baseY + 5 * s;
    ctx.strokeStyle = toCSS(skinColor); ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 3 * s, hipY); ctx.lineTo(cx - 5 * s, hipY + 8 * s); ctx.lineTo(cx - 4 * s, footY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 3 * s, hipY); ctx.lineTo(cx + 5 * s, hipY + 8 * s); ctx.lineTo(cx + 4 * s, footY); ctx.stroke();

    // Shorts
    ctx.fillStyle = toCSS(app.shortsColor); roundRect(ctx, cx - 6 * s, hipY - 1 * s, 12 * s, 6 * s, 2 * s);

    // Shoes (at the bottom of the legs, spread outward to match leg positions)
    const shoeY = baseY + 6 * s;
    ctx.fillStyle = toCSS(app.shoeColor);
    ctx.beginPath(); ctx.arc(cx - 5 * s, shoeY, 3 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 5 * s, shoeY, 3 * s, 0, Math.PI * 2); ctx.fill();

    // Torso
    ctx.fillStyle = toCSS(app.jerseyColor); roundRect(ctx, cx - 6 * s, torsoTop, 12 * s, 13 * s, 3 * s);

    // Jersey number
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `bold ${6 * s}px Arial`; ctx.textAlign = 'center';
    ctx.fillText('1', cx, torsoTop + 9 * s);

    // Arms
    ctx.strokeStyle = toCSS(skinColor); ctx.lineWidth = 2.5 * s;
    const shoulderY = torsoTop + 3 * s;
    ctx.beginPath(); ctx.moveTo(cx - 6 * s, shoulderY); ctx.lineTo(cx - 12 * s, shoulderY + 14 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 6 * s, shoulderY); ctx.lineTo(cx + 12 * s, shoulderY + 14 * s); ctx.stroke();

    // Wristbands
    if (app.accessory === 3) {
      ctx.fillStyle = toCSS(app.jerseyColor);
      ctx.beginPath(); ctx.arc(cx - 12 * s, shoulderY + 13 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + 12 * s, shoulderY + 13 * s, 2 * s, 0, Math.PI * 2); ctx.fill();
    }

    // Head
    ctx.fillStyle = toCSS(skinColor);
    ctx.beginPath(); ctx.arc(cx, headY, 7 * s, 0, Math.PI * 2); ctx.fill();

    // Hair — anchored to crown of head (headY - 7*s)
    const crownY = headY - 7 * s;
    ctx.fillStyle = toCSS(app.hairColor);
    switch (app.hairStyle) {
      case 0: // Short crop
        ctx.beginPath(); ctx.ellipse(cx, crownY + 2 * s, 7 * s, 4 * s, 0, Math.PI, 0); ctx.fill(); break;
      case 1: // Bald — no hair drawn
        break;
      case 2: // Afro
        ctx.beginPath(); ctx.arc(cx, crownY, 9 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = toCSS(skinColor); ctx.beginPath(); ctx.arc(cx, headY, 7 * s, 0, Math.PI * 2); ctx.fill();
        break;
      case 3: // (Removed — Spiky) — no hair
        break;
      case 4: // Mohawk
        ctx.fillStyle = toCSS(app.hairColor); roundRect(ctx, cx - 2 * s, crownY - 6 * s, 4 * s, 9 * s, 2 * s); break;
      case 5: // Long — cap on top with hair falling down sides (sides higher up)
        ctx.beginPath(); ctx.ellipse(cx, crownY + 2 * s, 8 * s, 4.5 * s, 0, Math.PI, 0); ctx.fill();
        ctx.fillRect(cx - 8 * s, crownY + 2 * s, 3 * s, 10 * s);
        ctx.fillRect(cx + 5 * s, crownY + 2 * s, 3 * s, 10 * s);
        break;
    }

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx - 2.5 * s, headY - 0.5 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 2.5 * s, headY - 0.5 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(cx - 2.5 * s, headY - 0.3 * s, 0.8 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 2.5 * s, headY - 0.3 * s, 0.8 * s, 0, Math.PI * 2); ctx.fill();

    // Mouth
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, headY + 2.5 * s, 2 * s, 0.1, Math.PI - 0.1); ctx.stroke();

    // Headband
    if (app.accessory === 1) { ctx.fillStyle = toCSS(app.jerseyColor); ctx.fillRect(cx - 7.5 * s, headY - 3 * s, 15 * s, 2.5 * s); }
    // Sunglasses
    if (app.accessory === 2) {
      ctx.fillStyle = '#111';
      roundRect(ctx, cx - 5.5 * s, headY - 2 * s, 4.5 * s, 3 * s, 1 * s);
      roundRect(ctx, cx + 1 * s, headY - 2 * s, 4.5 * s, 3 * s, 1 * s);
      ctx.fillRect(cx - 1 * s, headY - 1 * s, 2 * s, 1 * s);
    }
  };

  const handleSave = async () => {
    if (athleteName.trim().length < 2) { setNameError('Name must be at least 2 characters'); return; }
    if (hasProfanity(athleteName)) { setNameError('Inappropriate name. Please choose another.'); return; }
    setNameError('');
    setSaving(true);
    try {
      await api.updateAthleteAppearance(athlete.id, { ...app, customName: athleteName.trim() });
      onSave();
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  const t = athlete.template;

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a2e, #1a1a0e)',
      padding: 20, display: 'flex', gap: 30, justifyContent: 'center', flexWrap: 'wrap',
    }}>
      {/* Preview */}
      <div style={{
        background: 'rgba(20,20,50,0.8)', borderRadius: 16, padding: 24,
        border: '2px solid #FFD700', width: 300, textAlign: 'center',
      }}>
        <h3 style={{ color: '#FFD700', marginBottom: 8, fontSize: 20 }}>
          {athleteName || t?.name || 'Athlete'}
        </h3>
        <div style={{ color: '#aaa', fontSize: 14, marginBottom: 12 }}>
          {t?.rarity?.toUpperCase()} | OVR {t?.overallRating} | {t?.specialtyEvent}
        </div>
        <canvas ref={canvasRef} width={280} height={350}
          style={{ background: 'linear-gradient(180deg, #87ceeb, #3a8a3a)', borderRadius: 12 }} />
      </div>

      {/* Options */}
      <div style={{
        background: 'rgba(20,20,50,0.8)', borderRadius: 16, padding: 24,
        border: '1px solid #444', width: 520, overflowY: 'auto', maxHeight: '90vh',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <button onClick={onBack} style={backBtnStyle}>Back</button>
          <h2 style={{ color: '#fff', margin: 0, fontSize: 22 }}>Customize Athlete</h2>
          <button onClick={handleSave} disabled={saving} style={{
            background: 'linear-gradient(135deg, #FFD700, #ff8800)', color: '#000',
            border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 18,
            fontWeight: 'bold', cursor: 'pointer', opacity: saving ? 0.7 : 1,
          }}>{saving ? 'Saving...' : 'Save'}</button>
        </div>

        <Section title="Athlete Name">
          <input type="text" value={athleteName} maxLength={24}
            onChange={e => { setAthleteName(e.target.value); setNameError(''); }}
            style={inputStyle} placeholder="Enter athlete name..." />
          {nameError && <div style={{ color: '#ff4444', fontSize: 13, marginTop: 4 }}>{nameError}</div>}
        </Section>

        <Section title="Skin Tone">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SKIN_TONES.map((st, i) => (
              <SwatchBtn key={i} color={st.color} label={st.label}
                selected={app.skinTone === i} onClick={() => setApp({ ...app, skinTone: i })} />
            ))}
          </div>
        </Section>

        <Section title="Hair Style">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {HAIR_STYLES.map((hs, i) => hs ? (
              <button key={i} onClick={() => setApp({ ...app, hairStyle: i })} style={{
                background: app.hairStyle === i ? '#FFD700' : '#333', color: app.hairStyle === i ? '#000' : '#ccc',
                border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 15,
                fontWeight: app.hairStyle === i ? 'bold' : 'normal',
              }}>{hs}</button>
            ) : null)}
          </div>
        </Section>

        <Section title="Hair Color">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {HAIR_COLORS.map((hc, i) => (
              <SwatchBtn key={i} color={hc.color} label={hc.label}
                selected={app.hairColor === hc.color} onClick={() => setApp({ ...app, hairColor: hc.color })} />
            ))}
          </div>
        </Section>

        <Section title="Jersey Color">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {JERSEY_COLORS.map((c, i) => (
              <SwatchBtn key={i} color={c} selected={app.jerseyColor === c} onClick={() => setApp({ ...app, jerseyColor: c })} />
            ))}
          </div>
        </Section>

        <Section title="Shorts Color">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SHORTS_COLORS.map((c, i) => (
              <SwatchBtn key={i} color={c} selected={app.shortsColor === c} onClick={() => setApp({ ...app, shortsColor: c })} />
            ))}
          </div>
        </Section>

        <Section title="Shoe Color">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SHOE_COLORS.map((c, i) => (
              <SwatchBtn key={i} color={c} selected={app.shoeColor === c} onClick={() => setApp({ ...app, shoeColor: c })} />
            ))}
          </div>
        </Section>

        <Section title="Accessory">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ACCESSORIES.map((a, i) => (
              <button key={i} onClick={() => setApp({ ...app, accessory: i })} style={{
                background: app.accessory === i ? '#FFD700' : '#333', color: app.accessory === i ? '#000' : '#ccc',
                border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 15,
                fontWeight: app.accessory === i ? 'bold' : 'normal',
              }}>{a}</button>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: '#FFD700', fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function SwatchBtn({ color, label, selected, onClick }: {
  color: number; label?: string; selected: boolean; onClick: () => void;
}) {
  const hex = `#${color.toString(16).padStart(6, '0')}`;
  return (
    <button onClick={onClick} title={label} style={{
      width: 40, height: 40, borderRadius: 8, border: selected ? '3px solid #FFD700' : '2px solid #555',
      background: hex, cursor: 'pointer', boxShadow: selected ? '0 0 10px rgba(255,215,0,0.5)' : 'none',
    }} />
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.fill();
}

const backBtnStyle: React.CSSProperties = {
  background: '#333', color: '#fff', border: '1px solid #555',
  borderRadius: 10, padding: '12px 24px', cursor: 'pointer', fontSize: 18,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px', fontSize: 17,
  background: '#1a1a3a', border: '1px solid #444', borderRadius: 10, color: '#fff',
  outline: 'none',
};
