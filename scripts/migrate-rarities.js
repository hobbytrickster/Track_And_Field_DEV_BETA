#!/usr/bin/env node
/**
 * Migration: Fix card stats/OVR to match their rarity range.
 * Cards that were packed with stats outside their rarity's range
 * get their stats scaled to fit within the correct range.
 *
 * Run: node scripts/migrate-rarities.js [path-to-data.json]
 */

const fs = require('fs');
const dataPath = process.argv[2] || '/app/data/data.json';

if (!fs.existsSync(dataPath)) {
  console.log('Data file not found at:', dataPath);
  console.log('Usage: node scripts/migrate-rarities.js /path/to/data.json');
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Must match shared/constants RARITY_STAT_RANGES
const RANGES = {
  bronze:    { min: 15, max: 40, overallMin: 15, overallMax: 35 },
  silver:    { min: 36, max: 52, overallMin: 36, overallMax: 50 },
  gold:      { min: 48, max: 65, overallMin: 51, overallMax: 65 },
  platinum:  { min: 60, max: 78, overallMin: 66, overallMax: 78 },
  diamond:   { min: 74, max: 90, overallMin: 79, overallMax: 90 },
  superstar: { min: 92, max: 99, overallMin: 96, overallMax: 100 },
  legend:    { min: 99, max: 99, overallMin: 100, overallMax: 100 },
};

// Simple PRNG for reproducible randomization
let seed = 12345;
function rand() {
  seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
  return (seed >>> 0) / 0xFFFFFFFF;
}

function calcOVR(stats) {
  return Math.round(stats.speed * 0.35 + stats.stamina * 0.25 + stats.acceleration * 0.25 + stats.form * 0.15);
}

// Load templates to get base rarity
let TEMPLATES;
try {
  TEMPLATES = require('../packages/shared/dist/constants').ATHLETE_TEMPLATES;
} catch {
  try {
    TEMPLATES = require('/app/packages/shared/dist/constants').ATHLETE_TEMPLATES;
  } catch {
    console.log('Warning: Could not load ATHLETE_TEMPLATES, using cardId lookup from data');
    TEMPLATES = null;
  }
}

let fixed = 0;
let total = 0;

for (const athlete of db.userAthletes) {
  total++;

  // Determine the card's rarity from base template
  let rarity;
  if (TEMPLATES) {
    const tmpl = TEMPLATES.find(t => t.id === athlete.cardId);
    rarity = tmpl?.rarity;
  }
  // If we have overrideRarity already, use that
  if (athlete.overrideRarity) rarity = athlete.overrideRarity;
  if (!rarity) { console.log(`  Skipping cardId ${athlete.cardId} — no rarity found`); continue; }

  const range = RANGES[rarity];
  if (!range) continue;

  // Check if stats need fixing
  const stats = athlete.overrideStats;
  const ovr = athlete.overrideOverall ?? (stats ? calcOVR(stats) : null);

  if (ovr === null) continue; // no overrides, skip

  const needsFix = ovr < range.overallMin || ovr > range.overallMax;
  if (!needsFix) continue;

  // Regenerate stats within the rarity range
  const randStat = () => Math.floor(range.min + rand() * (range.max - range.min));
  let speed = randStat(), stamina = randStat(), acceleration = randStat(), form = randStat();

  // Apply specialty boosts if we know the event
  let event = null;
  if (TEMPLATES) {
    const tmpl = TEMPLATES.find(t => t.id === athlete.cardId);
    event = tmpl?.specialtyEvent;
  }
  if (event === '200m') { speed = Math.min(99, speed + 5); acceleration = Math.min(99, acceleration + 4); }
  if (event === '400m') { speed = Math.min(99, speed + 3); stamina = Math.min(99, stamina + 3); }
  if (event === '800m') { stamina = Math.min(99, stamina + 5); form = Math.min(99, form + 4); }
  if (event === '2000mSC') { stamina = Math.min(99, stamina + 6); form = Math.min(99, form + 5); }

  const newOVR = calcOVR({ speed, stamina, acceleration, form });

  const name = athlete.overrideName || athlete.appearance?.customName || `cardId:${athlete.cardId}`;
  console.log(`  ${name} — ${rarity}: OVR ${ovr} → ${newOVR} (was outside ${range.overallMin}-${range.overallMax})`);

  athlete.overrideStats = { speed, stamina, acceleration, form };
  athlete.overrideOverall = newOVR;
  // Ensure rarity is stored
  athlete.overrideRarity = rarity;
  fixed++;
}

fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
console.log(`\nDone! Fixed ${fixed}/${total} athletes.`);
console.log('Restart the server/container to apply changes.');
