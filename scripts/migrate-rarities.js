#!/usr/bin/env node
/**
 * Migration: Fix card rarities based on actual OVR.
 * Cards that were packed with a low-tier template but have high OVR
 * (from randomized stats) get reassigned to the correct rarity template.
 *
 * Run: node scripts/migrate-rarities.js [path-to-data.json]
 */

const fs = require('fs');
const path = process.argv[2] || '/app/data/data.json';

if (!fs.existsSync(path)) {
  console.log('Data file not found at:', path);
  console.log('Usage: node scripts/migrate-rarities.js /path/to/data.json');
  process.exit(1);
}

const db = JSON.parse(fs.readFileSync(path, 'utf8'));

// OVR → correct rarity
function ovrToRarity(ovr) {
  if (ovr >= 99) return 'legend';
  if (ovr >= 96) return 'superstar';
  if (ovr >= 79) return 'diamond';
  if (ovr >= 66) return 'platinum';
  if (ovr >= 51) return 'gold';
  if (ovr >= 36) return 'silver';
  return 'bronze';
}

let fixed = 0;
let total = 0;

for (const athlete of db.userAthletes) {
  total++;

  // Determine the effective OVR
  let ovr;
  if (athlete.overrideOverall != null) {
    ovr = athlete.overrideOverall;
  } else if (athlete.overrideStats) {
    const s = athlete.overrideStats;
    ovr = Math.round(s.speed * 0.35 + s.stamina * 0.25 + s.acceleration * 0.25 + s.form * 0.15);
  } else {
    continue; // no overrides, skip — base template rarity is correct
  }

  const correctRarity = ovrToRarity(ovr);

  // Store the correct rarity as an override so the server uses it
  if (!athlete.overrideRarity || athlete.overrideRarity !== correctRarity) {
    const oldRarity = athlete.overrideRarity || '(base template)';
    athlete.overrideRarity = correctRarity;
    fixed++;

    const name = athlete.overrideName || athlete.appearance?.customName || `cardId:${athlete.cardId}`;
    console.log(`  ${name} — OVR ${ovr}: ${oldRarity} → ${correctRarity}`);
  }
}

fs.writeFileSync(path, JSON.stringify(db, null, 2));
console.log(`\nDone! Fixed ${fixed}/${total} athletes.`);
console.log('Restart the server/container to apply changes.');
