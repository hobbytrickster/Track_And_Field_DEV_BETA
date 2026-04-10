import React, { useState } from 'react';
import { api } from '../../api/client';

interface StadiumConfig {
  upperDeckColor: number;
  seatColor: number;
  infieldLogo: number;
  logoColor: number;
  trackColor: number;
  fieldColor: number;
  fieldStyle: string;
  stadiumName: string;
}

const DEFAULT_STADIUM: StadiumConfig = {
  upperDeckColor: 0x444455,
  seatColor: 0x555566,
  infieldLogo: 0,
  logoColor: 0xffd700,
  trackColor: 0xcc4433,
  fieldColor: 0x2a7a2a,
  fieldStyle: 'green',
  stadiumName: '',
};

const FIELD_STYLES = [
  { key: 'green', label: 'Green', color: '#2a7a2a' },
  { key: 'red', label: 'Red', color: '#8a2222' },
  { key: 'blue', label: 'Blue', color: '#224488' },
  { key: 'purple', label: 'Purple', color: '#552288' },
  { key: 'pink', label: 'Pink', color: '#aa4488' },
  { key: 'orange', label: 'Orange', color: '#cc6622' },
  { key: 'white', label: 'White', color: '#cccccc' },
  { key: 'black', label: 'Black', color: '#222222' },
  { key: 'grey', label: 'Grey', color: '#666666' },
  { key: 'rainbow', label: 'Rainbow', color: 'linear-gradient(90deg, red, orange, yellow, green, blue, purple)' },
  { key: 'yellow', label: 'Yellow', color: '#aaaa22' },
];

const DECK_COLORS = [0x444455, 0x333344, 0x554433, 0x334444, 0x443355, 0x553333, 0x222222, 0x555555];
const SEAT_COLORS = [0x555566, 0x445577, 0x665544, 0x446655, 0x554466, 0x664444, 0x333333, 0x777777];
const TRACK_COLORS = [0xcc4433, 0x3344aa, 0x228833, 0x444444, 0x884422, 0x993366, 0x226688, 0xaa6622];
// Field colors removed — using image-based field styles now
const LOGO_COLORS = [0xffd700, 0xffffff, 0xff4444, 0x4488ff, 0x44cc44, 0xff8800, 0xff44ff, 0x000000];
const LOGOS = ['None', 'Shield', 'Star', 'Diamond', 'Rings', 'Flame'];

interface Props {
  currentStadium: StadiumConfig | null;
  onSave: (stadium: StadiumConfig) => void;
  onBack: () => void;
}

export function Stadium({ currentStadium, onSave, onBack }: Props) {
  const [cfg, setCfg] = useState<StadiumConfig>(currentStadium || DEFAULT_STADIUM);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateStadium(cfg);
      onSave(cfg);
    } catch (err: any) { alert(err.message); }
    setSaving(false);
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a2e, #1a1a0e)',
      padding: 20, display: 'flex', gap: 30, justifyContent: 'center', alignItems: 'stretch', flexWrap: 'wrap',
    }}>
      {/* Preview */}
      <div style={{
        background: 'rgba(20,20,50,0.8)', borderRadius: 16, padding: 28,
        border: '2px solid #FFD700', width: 550, textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <h3 style={{ color: '#FFD700', marginBottom: 16, fontSize: 24 }}>Stadium Preview</h3>
        <StadiumPreview cfg={cfg} />
        {cfg.stadiumName && (
          <div style={{ marginTop: 12, color: '#FFD700', fontSize: 18, fontWeight: 'bold' }}>{cfg.stadiumName}</div>
        )}
      </div>

      {/* Options */}
      <div style={{
        background: 'rgba(20,20,50,0.8)', borderRadius: 16, padding: 24,
        border: '1px solid #444', width: 520, overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <button onClick={onBack} style={backBtnStyle}>Back</button>
          <h2 style={{ color: '#fff', margin: 0, fontSize: 22 }}>Customize Stadium</h2>
          <button onClick={handleSave} disabled={saving} style={{
            background: 'linear-gradient(135deg, #FFD700, #ff8800)', color: '#000',
            border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 18,
            fontWeight: 'bold', cursor: 'pointer', opacity: saving ? 0.7 : 1,
          }}>{saving ? 'Saving...' : 'Save'}</button>
        </div>

        <Section title="Stadium Name">
          <input type="text" value={cfg.stadiumName} placeholder="Name your stadium..."
            onChange={e => setCfg({ ...cfg, stadiumName: e.target.value })} style={inputStyle} />
        </Section>

        <Section title="Track Surface Color">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TRACK_COLORS.map((c, i) => (
              <SwatchBtn key={i} color={c} selected={cfg.trackColor === c}
                onClick={() => setCfg({ ...cfg, trackColor: c })} />
            ))}
          </div>
        </Section>

        <Section title="Field Style">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FIELD_STYLES.map(fs => (
              <button key={fs.key} onClick={() => setCfg({ ...cfg, fieldStyle: fs.key })} style={{
                width: 70, height: 50, borderRadius: 8, cursor: 'pointer',
                border: cfg.fieldStyle === fs.key ? '3px solid #FFD700' : '2px solid #555',
                background: fs.color.includes('gradient') ? fs.color : fs.color,
                boxShadow: cfg.fieldStyle === fs.key ? '0 0 10px rgba(255,215,0,0.5)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: ['white', 'yellow', 'orange'].includes(fs.key) ? '#333' : '#fff',
                fontSize: 11, fontWeight: 'bold',
              }}>{fs.label}</button>
            ))}
          </div>
        </Section>

        <Section title="Upper Deck Color">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {DECK_COLORS.map((c, i) => (
              <SwatchBtn key={i} color={c} selected={cfg.upperDeckColor === c}
                onClick={() => setCfg({ ...cfg, upperDeckColor: c })} />
            ))}
          </div>
        </Section>

        <Section title="Seat Color">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {SEAT_COLORS.map((c, i) => (
              <SwatchBtn key={i} color={c} selected={cfg.seatColor === c}
                onClick={() => setCfg({ ...cfg, seatColor: c })} />
            ))}
          </div>
        </Section>

        {/* Logo options removed — will be reimplemented later */}
      </div>
    </div>
  );
}

function StadiumPreview({ cfg }: { cfg: StadiumConfig }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [turfImages, setTurfImages] = React.useState<Record<string, HTMLImageElement>>({});

  // Preload turf images
  React.useEffect(() => {
    const styles = ['green','red','blue','purple','pink','orange','white','black','grey','rainbow','yellow'];
    const loaded: Record<string, HTMLImageElement> = {};
    let count = 0;
    for (const s of styles) {
      const img = new Image();
      img.onload = () => { loaded[s] = img; count++; if (count === styles.length) setTurfImages({ ...loaded }); };
      img.onerror = () => { count++; if (count === styles.length) setTurfImages({ ...loaded }); };
      img.src = `/assets/track/turf_${s}.png`;
    }
  }, []);

  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const w = c.width, h = c.height;
    const cx = w / 2, cy = h / 2;
    const toCSS = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

    // Background
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(0, 0, w, h);

    // Outer wall
    ctx.fillStyle = '#2a2a3a';
    ctx.beginPath(); ctx.ellipse(cx, cy, 140, 95, 0, 0, Math.PI * 2); ctx.fill();

    // Upper deck
    ctx.fillStyle = toCSS(cfg.upperDeckColor);
    ctx.beginPath(); ctx.ellipse(cx, cy, 130, 88, 0, 0, Math.PI * 2); ctx.fill();

    // Seats
    ctx.fillStyle = toCSS(cfg.seatColor);
    ctx.beginPath(); ctx.ellipse(cx, cy, 115, 78, 0, 0, Math.PI * 2); ctx.fill();

    // Track
    ctx.fillStyle = toCSS(cfg.trackColor);
    ctx.beginPath(); ctx.ellipse(cx, cy, 95, 62, 0, 0, Math.PI * 2); ctx.fill();

    // Infield — use turf image if loaded, fallback to color
    const turfImg = turfImages[cfg.fieldStyle || 'green'];
    if (turfImg) {
      // Clip to oval, draw image
      ctx.save();
      ctx.beginPath(); ctx.ellipse(cx, cy, 65, 40, 0, 0, Math.PI * 2); ctx.clip();
      const scale = Math.max(130 / turfImg.width, 80 / turfImg.height) * 1.1;
      const iw = turfImg.width * scale;
      const ih = turfImg.height * scale;
      ctx.drawImage(turfImg, cx - iw / 2, cy - ih / 2 + 2, iw, ih);
      ctx.restore();
    } else {
      ctx.fillStyle = toCSS(cfg.fieldColor);
      ctx.beginPath(); ctx.ellipse(cx, cy, 65, 40, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Lane lines
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.ellipse(cx, cy, 68 + i * 7, 43 + i * 5, 0, 0, Math.PI * 2); ctx.stroke();
    }
  }, [cfg, turfImages]);

  return <canvas ref={canvasRef} width={500} height={330} style={{ borderRadius: 12, border: '1px solid #444', width: 500, height: 330 }} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 20 }}>
    <div style={{ color: '#FFD700', fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>{title}</div>
    {children}
  </div>;
}

function SwatchBtn({ color, selected, onClick }: { color: number; selected: boolean; onClick: () => void }) {
  return <button onClick={onClick} style={{
    width: 44, height: 44, borderRadius: 8,
    border: selected ? '3px solid #FFD700' : '2px solid #555',
    background: `#${color.toString(16).padStart(6, '0')}`,
    cursor: 'pointer', boxShadow: selected ? '0 0 10px rgba(255,215,0,0.5)' : 'none',
  }} />;
}

const backBtnStyle: React.CSSProperties = {
  background: '#333', color: '#fff', border: '1px solid #555',
  borderRadius: 10, padding: '12px 24px', cursor: 'pointer', fontSize: 18,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '14px 18px', fontSize: 18,
  background: '#1a1a3a', border: '1px solid #444', borderRadius: 10, color: '#fff', outline: 'none',
};
