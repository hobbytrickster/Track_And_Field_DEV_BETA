/**
 * Procedural racing music using Web Audio API.
 * Multiple distinct songs with different keys, tempos, and patterns.
 * A random song is selected each time music starts.
 */

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let isPlaying = false;
let intervalId: number | null = null;
let currentSong: Song | null = null;
let currentBar = 0;
let beat_duration = 0;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(audioCtx.destination);
  }
  return audioCtx;
}

function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

// ═══════════════════════════════════════════════════════════
// Sound primitives
// ═══════════════════════════════════════════════════════════

function playTone(freq: number, start: number, dur: number, type: OscillatorType, vol: number) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(g);
  g.connect(masterGain!);
  osc.start(start);
  osc.stop(start + dur);
}

function playChord(notes: number[], start: number, dur: number, type: OscillatorType, vol: number) {
  for (const n of notes) playTone(midiToFreq(n), start, dur, type, vol / notes.length);
}

function playNoise(start: number, dur: number, vol: number, filterFreq: number = 8000) {
  const ctx = getCtx();
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = filterFreq;
  src.connect(f);
  f.connect(g);
  g.connect(masterGain!);
  src.start(start);
}

function playKick(start: number, punch: number = 150) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(punch, start);
  osc.frequency.exponentialRampToValueAtTime(30, start + 0.15);
  g.gain.setValueAtTime(0.4, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
  osc.connect(g);
  g.connect(masterGain!);
  osc.start(start);
  osc.stop(start + 0.2);
}

function playSnare(start: number) {
  const ctx = getCtx();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 3000;
  src.connect(f);
  f.connect(g);
  g.connect(masterGain!);
  src.start(start);
  // tonal body
  const osc = ctx.createOscillator();
  const og = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 200;
  og.gain.setValueAtTime(0.15, start);
  og.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
  osc.connect(og);
  og.connect(masterGain!);
  osc.start(start);
  osc.stop(start + 0.1);
}

function playClap(start: number) {
  const ctx = getCtx();
  // layered noise bursts
  for (let i = 0; i < 3; i++) {
    const offset = i * 0.01;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.06, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let j = 0; j < d.length; j++) d[j] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, start + offset);
    g.gain.exponentialRampToValueAtTime(0.001, start + offset + 0.08);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1500;
    f.Q.value = 2;
    src.connect(f);
    f.connect(g);
    g.connect(masterGain!);
    src.start(start + offset);
  }
}

function playRim(start: number) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = 800;
  g.gain.setValueAtTime(0.15, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + 0.03);
  osc.connect(g);
  g.connect(masterGain!);
  osc.start(start);
  osc.stop(start + 0.04);
}

// ═══════════════════════════════════════════════════════════
// Song definitions
// ═══════════════════════════════════════════════════════════

interface Song {
  name: string;
  bpm: number;
  root: number;        // MIDI root note
  bassOctave: number;  // MIDI octave for bass
  leadOctave: number;  // MIDI octave for lead
  bassType: OscillatorType;
  leadType: OscillatorType;
  bassPatterns: number[][];
  leadPatterns: number[][];
  drumPattern: (t: number, beat: number, BEAT: number) => void;
  chordProg?: number[][];  // optional chord hits
}

const SONGS: Song[] = [
  // ── Song 1: "Sprint Anthem" — driving four-on-the-floor EDM ──
  {
    name: 'Sprint Anthem',
    bpm: 140,
    root: 48, // C3
    bassOctave: 36,
    leadOctave: 60,
    bassType: 'sawtooth',
    leadType: 'square',
    bassPatterns: [
      [0, 0, 7, 5],
      [0, 3, 5, 7],
      [0, 0, 5, 3],
      [0, 7, 5, 0],
    ],
    leadPatterns: [
      [12, 15, 17, 19, 17, 15, 12, 10],
      [12, 14, 17, 14, 12, 10, 7, 10],
      [12, 12, 15, 15, 17, 17, 19, 17],
      [7, 10, 12, 15, 12, 10, 7, 5],
    ],
    drumPattern: (t, beat, BEAT) => {
      playKick(t);
      if (beat === 1 || beat === 3) playSnare(t);
      playNoise(t, 0.05, 0.06);
      playNoise(t + BEAT / 2, 0.04, 0.04);
    },
  },

  // ── Song 2: "Neon Dash" — synth-wave with arpeggios, 130 BPM ──
  {
    name: 'Neon Dash',
    bpm: 130,
    root: 45, // A2
    bassOctave: 33,
    leadOctave: 57,
    bassType: 'square',
    leadType: 'sawtooth',
    bassPatterns: [
      [0, 0, 0, 5],
      [0, 7, 7, 5],
      [0, 0, 3, 5],
      [7, 5, 3, 0],
    ],
    leadPatterns: [
      [0, 4, 7, 12, 7, 4, 0, -5],   // arpeggiated Am
      [3, 7, 10, 15, 10, 7, 3, 0],   // arpeggiated C
      [5, 9, 12, 17, 12, 9, 5, 0],   // arpeggiated Dm
      [7, 11, 14, 19, 14, 11, 7, 3], // arpeggiated Em
    ],
    drumPattern: (t, beat, BEAT) => {
      playKick(t, 120);
      if (beat === 1 || beat === 3) playClap(t);
      if (beat === 0 || beat === 2) playRim(t + BEAT / 2);
      playNoise(t, 0.04, 0.05);
      playNoise(t + BEAT / 2, 0.03, 0.03);
      // Extra offbeat kick for groove
      if (beat === 2) playKick(t + BEAT * 0.75, 80);
    },
  },

  // ── Song 3: "Thunder Lane" — heavy bass, half-time feel, 150 BPM ──
  {
    name: 'Thunder Lane',
    bpm: 150,
    root: 43, // G2
    bassOctave: 31,
    leadOctave: 55,
    bassType: 'sawtooth',
    leadType: 'triangle',
    bassPatterns: [
      [0, 0, 12, 0],
      [0, 5, 7, 5],
      [0, 0, 10, 7],
      [0, 3, 7, 10],
    ],
    leadPatterns: [
      [7, -1, 12, -1, 10, -1, 7, -1],   // staccato (-1 = rest)
      [12, 10, 7, -1, 5, 7, 10, 12],
      [14, -1, 14, 12, 10, -1, 7, -1],
      [7, 10, 12, 14, 12, 10, 7, 5],
    ],
    drumPattern: (t, beat, BEAT) => {
      // Half-time: kick on 1, snare on 3
      if (beat === 0) playKick(t, 180);
      if (beat === 2) { playSnare(t); playKick(t, 100); }
      // Driving hi-hats
      playNoise(t, 0.04, 0.07);
      playNoise(t + BEAT * 0.25, 0.03, 0.03);
      playNoise(t + BEAT * 0.5, 0.04, 0.05);
      playNoise(t + BEAT * 0.75, 0.03, 0.03);
    },
    chordProg: [
      [0, 3, 7],     // Gm
      [5, 8, 12],    // Cm
      [3, 7, 10],    // Bb
      [5, 10, 14],   // Dm
    ],
  },

  // ── Song 4: "Gold Medal" — triumphant major key, 135 BPM ──
  {
    name: 'Gold Medal',
    bpm: 135,
    root: 50, // D3
    bassOctave: 38,
    leadOctave: 62,
    bassType: 'triangle',
    leadType: 'square',
    bassPatterns: [
      [0, 4, 7, 4],
      [0, 0, 7, 7],
      [5, 5, 9, 7],
      [0, 7, 4, 0],
    ],
    leadPatterns: [
      [12, 16, 19, 24, 19, 16, 12, 7],  // major arpeggio up and down
      [24, 23, 21, 19, 16, 14, 12, 14],  // descending scale
      [12, 14, 16, 19, 21, 19, 16, 14],  // scale run
      [7, 12, 7, 16, 12, 19, 16, 12],    // jumping intervals
    ],
    drumPattern: (t, beat, BEAT) => {
      playKick(t, 140);
      if (beat === 1 || beat === 3) playSnare(t);
      // Shaker pattern (triplet feel)
      playNoise(t, 0.03, 0.04, 10000);
      playNoise(t + BEAT * 0.33, 0.02, 0.03, 10000);
      playNoise(t + BEAT * 0.67, 0.02, 0.03, 10000);
    },
    chordProg: [
      [0, 4, 7],      // D major
      [5, 9, 12],     // G major
      [7, 11, 14],    // A major
      [0, 4, 7],      // D major
    ],
  },

  // ── Song 5: "Final Stretch" — intense buildup, 145 BPM ──
  {
    name: 'Final Stretch',
    bpm: 145,
    root: 46, // Bb2
    bassOctave: 34,
    leadOctave: 58,
    bassType: 'sawtooth',
    leadType: 'sawtooth',
    bassPatterns: [
      [0, 0, 0, 0],   // driving root
      [0, 0, 5, 5],
      [0, 0, 7, 7],
      [0, 5, 7, 10],
    ],
    leadPatterns: [
      [10, 12, 15, 17, 15, 12, 10, 8],
      [17, 15, 12, 10, 8, 10, 12, 15],
      [5, 8, 10, 12, 15, 12, 10, 8],
      [12, 15, 17, 20, 17, 15, 12, 10],
    ],
    drumPattern: (t, beat, BEAT) => {
      // Double kick pattern
      playKick(t, 160);
      if (beat === 1 || beat === 3) playKick(t + BEAT * 0.5, 100);
      if (beat === 1 || beat === 3) playClap(t);
      // Rapid hi-hats
      for (let i = 0; i < 4; i++) {
        playNoise(t + BEAT * i / 4, 0.03, 0.04 + (i % 2) * 0.02);
      }
    },
  },
];

// ═══════════════════════════════════════════════════════════
// Scheduling
// ═══════════════════════════════════════════════════════════

function scheduleBar(barStartTime: number) {
  if (!currentSong) return;
  const song = currentSong;
  const BEAT = beat_duration;

  const bassPattern = song.bassPatterns[currentBar % song.bassPatterns.length];
  const leadPattern = song.leadPatterns[currentBar % song.leadPatterns.length];
  const chords = song.chordProg?.[currentBar % (song.chordProg?.length || 1)];

  for (let beat = 0; beat < 4; beat++) {
    const t = barStartTime + beat * BEAT;

    // Drums
    song.drumPattern(t, beat, BEAT);

    // Bass
    const bassNote = bassPattern[beat];
    playTone(midiToFreq(song.bassOctave + bassNote), t, BEAT * 0.8, song.bassType, 0.10);

    // Lead melody (eighth notes)
    const li1 = beat * 2;
    const li2 = beat * 2 + 1;
    if (li1 < leadPattern.length && leadPattern[li1] !== -1) {
      playTone(midiToFreq(song.leadOctave + leadPattern[li1]), t, BEAT * 0.4, song.leadType, 0.05);
    }
    if (li2 < leadPattern.length && leadPattern[li2] !== -1) {
      playTone(midiToFreq(song.leadOctave + leadPattern[li2]), t + BEAT / 2, BEAT * 0.35, song.leadType, 0.04);
    }

    // Chord stabs (on beats 1 and 3 if the song has chords)
    if (chords && (beat === 0 || beat === 2)) {
      const chordNotes = chords.map(n => song.root + 12 + n); // one octave above root
      playChord(chordNotes, t, BEAT * 0.3, 'triangle', 0.06);
    }
  }

  currentBar++;
}

// ═══════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════

export function startMusic() {
  if (isPlaying) return;
  isPlaying = true;
  currentBar = 0;

  // Pick a random song
  currentSong = SONGS[Math.floor(Math.random() * SONGS.length)];
  beat_duration = 60 / currentSong.bpm;

  const ctx = getCtx();
  if (ctx.state === 'suspended') ctx.resume();

  let nextBarTime = ctx.currentTime + 0.1;

  // Schedule first bars
  for (let i = 0; i < 2; i++) {
    scheduleBar(nextBarTime);
    nextBarTime += beat_duration * 4;
  }

  // Keep scheduling ahead
  intervalId = window.setInterval(() => {
    if (!isPlaying) return;
    const ctx = getCtx();
    if (nextBarTime - ctx.currentTime < beat_duration * 4) {
      scheduleBar(nextBarTime);
      nextBarTime += beat_duration * 4;
    }
  }, 200);
}

export function stopMusic() {
  isPlaying = false;
  currentSong = null;
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
    masterGain = null;
  }
}

export function setMusicVolume(vol: number) {
  if (masterGain) {
    const muted = localStorage.getItem('winbig_muted') === 'true';
    masterGain.gain.value = muted ? 0 : Math.max(0, Math.min(1, vol));
  }
}

// ═══════════════════════════════════════════════════════════
// Menu / Lobby Music — chill ambient loop
// ═══════════════════════════════════════════════════════════

let menuCtx: AudioContext | null = null;
let menuGain: GainNode | null = null;
let menuPlaying = false;
let menuIntervalId: number | null = null;
let menuBar = 0;

const MENU_BPM = 85;
const MENU_BEAT = 60 / MENU_BPM;

// Chill chord progression in C major: Am - F - C - G
const MENU_CHORDS = [
  [57, 60, 64],  // Am
  [53, 57, 60],  // F
  [48, 52, 55],  // C
  [55, 59, 62],  // G
];

const MENU_MELODY = [
  [64, 67, 69, 72, 69, 67, 64, 60],
  [65, 69, 72, 69, 65, 64, 60, 64],
  [60, 64, 67, 72, 67, 64, 60, 55],
  [62, 67, 71, 67, 62, 60, 59, 55],
];

function getMenuCtx(): AudioContext {
  if (!menuCtx) {
    menuCtx = new AudioContext();
    menuGain = menuCtx.createGain();
    menuGain.gain.value = 0.45;
    menuGain.connect(menuCtx.destination);
  }
  return menuCtx;
}

function menuTone(freq: number, start: number, dur: number, type: OscillatorType, vol: number) {
  const ctx = getMenuCtx();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(g);
  g.connect(menuGain!);
  osc.start(start);
  osc.stop(start + dur + 0.01);
}

function scheduleMenuBar(barStart: number) {
  const chord = MENU_CHORDS[menuBar % MENU_CHORDS.length];
  const melody = MENU_MELODY[menuBar % MENU_MELODY.length];

  for (let beat = 0; beat < 4; beat++) {
    const t = barStart + beat * MENU_BEAT;

    // Soft pad chord — sustained triangle waves
    if (beat === 0) {
      for (const note of chord) {
        menuTone(midiToFreq(note), t, MENU_BEAT * 3.8, 'sine', 0.03);
        menuTone(midiToFreq(note), t, MENU_BEAT * 3.8, 'triangle', 0.015);
      }
    }

    // Gentle bass note
    if (beat === 0 || beat === 2) {
      menuTone(midiToFreq(chord[0] - 12), t, MENU_BEAT * 1.8, 'sine', 0.06);
    }

    // Melody — soft eighth notes
    const m1 = melody[beat * 2];
    const m2 = melody[beat * 2 + 1];
    menuTone(midiToFreq(m1), t, MENU_BEAT * 0.45, 'sine', 0.035);
    menuTone(midiToFreq(m2), t + MENU_BEAT / 2, MENU_BEAT * 0.4, 'sine', 0.025);

    // Soft hi-hat tick
    if (beat === 1 || beat === 3) {
      const ctx = getMenuCtx();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.03, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 9000;
      src.connect(f); f.connect(g); g.connect(menuGain!);
      src.start(t);
    }
  }

  menuBar++;
}

export function startMenuMusic() {
  if (menuPlaying) return;
  menuPlaying = true;
  menuBar = 0;

  const ctx = getMenuCtx();
  if (ctx.state === 'suspended') ctx.resume();

  let nextBar = ctx.currentTime + 0.1;
  for (let i = 0; i < 2; i++) {
    scheduleMenuBar(nextBar);
    nextBar += MENU_BEAT * 4;
  }

  menuIntervalId = window.setInterval(() => {
    if (!menuPlaying) return;
    const ctx = getMenuCtx();
    if (nextBar - ctx.currentTime < MENU_BEAT * 4) {
      scheduleMenuBar(nextBar);
      nextBar += MENU_BEAT * 4;
    }
  }, 300);
}

export function stopMenuMusic() {
  menuPlaying = false;
  if (menuIntervalId !== null) {
    clearInterval(menuIntervalId);
    menuIntervalId = null;
  }
  if (menuCtx) {
    menuCtx.close();
    menuCtx = null;
    menuGain = null;
  }
}

// ═══════════════════════════════════════════════════════════
// Achievement Fanfare — plays once when results appear
// ═══════════════════════════════════════════════════════════

export function playFanfare(isVictory: boolean = false) {
  const ctx = new AudioContext();
  const gain = ctx.createGain();
  gain.gain.value = 0.25;
  gain.connect(ctx.destination);

  const t = ctx.currentTime + 0.05;

  const tone = (freq: number, start: number, dur: number, type: OscillatorType, vol: number) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(g); g.connect(gain);
    osc.start(start); osc.stop(start + dur + 0.01);
  };

  if (isVictory) {
    // Triumphant fanfare: C-E-G-C ascending, then a big chord
    tone(midiToFreq(60), t, 0.2, 'square', 0.08);       // C4
    tone(midiToFreq(64), t + 0.15, 0.2, 'square', 0.08); // E4
    tone(midiToFreq(67), t + 0.30, 0.2, 'square', 0.08); // G4
    tone(midiToFreq(72), t + 0.45, 0.5, 'square', 0.10); // C5
    // Big major chord
    tone(midiToFreq(60), t + 0.55, 1.2, 'triangle', 0.06);
    tone(midiToFreq(64), t + 0.55, 1.2, 'triangle', 0.06);
    tone(midiToFreq(67), t + 0.55, 1.2, 'triangle', 0.06);
    tone(midiToFreq(72), t + 0.55, 1.2, 'triangle', 0.06);
    // Cymbal shimmer
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.08, t + 0.55);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    src.connect(f); f.connect(g2); g2.connect(gain);
    src.start(t + 0.55);
  } else {
    // Standard finish sound: two-note chime
    tone(midiToFreq(67), t, 0.3, 'triangle', 0.08);       // G4
    tone(midiToFreq(72), t + 0.2, 0.5, 'triangle', 0.10); // C5
    // Soft chord
    tone(midiToFreq(60), t + 0.35, 0.8, 'sine', 0.04);
    tone(midiToFreq(64), t + 0.35, 0.8, 'sine', 0.04);
    tone(midiToFreq(67), t + 0.35, 0.8, 'sine', 0.04);
  }

  // Auto-close context after sounds finish
  setTimeout(() => ctx.close(), 3000);
}

// ═══════════════════════════════════════════════════════════
// Crowd Noise — real audio file with volume control
// Uses /assets/audio/crowd.mp3 (1-hour stadium recording),
// starts at a random offset each race for variety.
// ═══════════════════════════════════════════════════════════

let crowdAudio: HTMLAudioElement | null = null;
let crowdActive = false;
let crowdTargetVol = 0;
let crowdFadeInterval: number | null = null;

export function startCrowd() {
  if (crowdActive) return;
  crowdActive = true;

  crowdAudio = new Audio('/assets/audio/crowd.mp3');
  crowdAudio.loop = true;
  crowdAudio.volume = 0;

  // Start at a random point in the 1-hour file (skip first/last 60s)
  const randomStart = 60 + Math.random() * 3400; // 60s to ~3460s
  crowdAudio.currentTime = randomStart;

  crowdAudio.play().catch(() => {
    // Autoplay blocked — will start on next user interaction
    const handler = () => {
      if (crowdAudio) crowdAudio.play().catch(() => {});
      document.removeEventListener('click', handler);
    };
    document.addEventListener('click', handler);
  });
}

export function setCrowdVolume(vol: number, fadeTime: number = 0.5) {
  if (!crowdAudio) return;
  const muted = localStorage.getItem('winbig_muted') === 'true';
  crowdTargetVol = muted ? 0 : Math.max(0, Math.min(1, vol));

  // Clear any existing fade
  if (crowdFadeInterval !== null) {
    clearInterval(crowdFadeInterval);
    crowdFadeInterval = null;
  }

  // Smooth fade using setInterval (HTMLAudioElement doesn't have Web Audio scheduling)
  const steps = Math.max(1, Math.round(fadeTime * 30)); // 30fps fade
  const stepTime = (fadeTime * 1000) / steps;
  const startVol = crowdAudio.volume;
  const diff = crowdTargetVol - startVol;
  let step = 0;

  crowdFadeInterval = window.setInterval(() => {
    step++;
    if (!crowdAudio) { clearInterval(crowdFadeInterval!); crowdFadeInterval = null; return; }
    const t = step / steps;
    // Smooth ease
    const ease = t * t * (3 - 2 * t);
    crowdAudio.volume = Math.max(0, Math.min(1, startVol + diff * ease));
    if (step >= steps) {
      clearInterval(crowdFadeInterval!);
      crowdFadeInterval = null;
    }
  }, stepTime);
}

export function stopCrowd() {
  crowdActive = false;
  if (crowdFadeInterval !== null) { clearInterval(crowdFadeInterval); crowdFadeInterval = null; }
  if (crowdAudio) { crowdAudio.pause(); crowdAudio.src = ''; crowdAudio = null; }
}
