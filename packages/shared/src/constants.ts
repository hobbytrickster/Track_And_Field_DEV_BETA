import { Rarity, EventType, PackType, AthleteCardTemplate, BoostCardTemplate, BoostEffectType, SplitType } from './types';

// ============================================================
// Race Event Definitions
// ============================================================
export const RACE_EVENTS: Record<EventType, { distance: number; laps: number; staggered: boolean; laneBreakAfterMeters?: number }> = {
  '200m': { distance: 200, laps: 0.5, staggered: true },
  '400m': { distance: 400, laps: 1, staggered: true },
  '800m': { distance: 800, laps: 2, staggered: true, laneBreakAfterMeters: 115 },
};

// ============================================================
// Track Geometry
// ============================================================
export const TRACK = {
  straightLength: 84.39,  // meters per straight
  innerRadius: 36.5,      // meters (lane 1 inner edge)
  laneWidth: 1.22,        // meters per lane
  lanes: 8,
};

// Lane staggers for a full 400m lap (in meters)
export function getLaneStagger(lane: number): number {
  if (lane === 1) return 0;
  const radius = TRACK.innerRadius + (lane - 1) * TRACK.laneWidth;
  const innerRadius = TRACK.innerRadius + 0 * TRACK.laneWidth;
  // Stagger = 2 * PI * (radius - innerRadius) for one full lap
  return 2 * Math.PI * (radius - innerRadius);
}

// ============================================================
// Simulation Constants
// ============================================================
export const SIM = {
  tickRate: 60,            // ticks per second
  maxSpeedMs: 11.5,        // ~100m in 8.7s = elite sprinter (m/s)
  minSpeedMs: 8.5,         // slowest bronze athlete ~100m in 11.8s (m/s)
};

// ============================================================
// Overall Rating Calculation
// ============================================================
export function calculateOverallRating(stats: { speed: number; stamina: number; acceleration: number; form: number }): number {
  // Weighted average
  return Math.round(stats.speed * 0.35 + stats.stamina * 0.25 + stats.acceleration * 0.25 + stats.form * 0.15);
}

// ============================================================
// Stat Ranges by Rarity
// ============================================================
export const RARITY_STAT_RANGES: Record<Rarity, { min: number; max: number; overallMin: number; overallMax: number }> = {
  bronze:   { min: 20, max: 45, overallMin: 20, overallMax: 40 },
  silver:   { min: 35, max: 60, overallMin: 35, overallMax: 55 },
  gold:     { min: 50, max: 75, overallMin: 50, overallMax: 70 },
  platinum: { min: 65, max: 90, overallMin: 65, overallMax: 85 },
  diamond:  { min: 80, max: 99, overallMin: 80, overallMax: 99 },
};

// ============================================================
// Economy
// ============================================================
export const ECONOMY = {
  startingCoins: 500,
  winReward: 75,
  podiumReward: 25,   // bonus for 2nd or 3rd place
  loseReward: 40,
  winXP: 25,
  loseXP: 10,
  dailyFirstRaceBonus: 100,
  levelUpBonus: 200,
  xpPerLevel: 100,
  // Sell values per rarity when releasing a card
  sellValues: { bronze: 25, silver: 50, gold: 100, platinum: 200, diamond: 500 } as Record<string, number>,
};

export const PACK_COSTS: Record<PackType, number> = {
  bronze: 200,
  silver: 400,
  gold: 1000,
  boost: 300,
};

export const PACK_CONTENTS: Record<PackType, { athletes: number; boosts: number }> = {
  bronze: { athletes: 3, boosts: 2 },
  silver: { athletes: 3, boosts: 3 },
  gold:   { athletes: 1, boosts: 3 },
  boost:  { athletes: 0, boosts: 5 },
};

// Drop rates: probability of each rarity per athlete in a pack
export const PACK_DROP_RATES: Record<PackType, Record<Rarity, number>> = {
  bronze: {
    bronze: 0.70,
    silver: 0.25,
    gold: 0.05,
    platinum: 0,
    diamond: 0,
  },
  silver: {
    bronze: 0,
    silver: 0.40,
    gold: 0.40,
    platinum: 0.18,
    diamond: 0.02,
  },
  gold: {
    bronze: 0,
    silver: 0,
    gold: 0.30,
    platinum: 0.45,
    diamond: 0.25,
  },
  boost: {
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0,
    diamond: 0,
  },
};

// ============================================================
// Seed Data: Athlete Card Templates
// ============================================================
const NATIONALITIES = ['USA', 'JAM', 'GBR', 'KEN', 'ETH', 'RSA', 'CAN', 'JPN', 'GER', 'FRA', 'NGA', 'AUS', 'BRA', 'TTO', 'CHN'];

const FIRST_NAMES = ['Marcus', 'Devon', 'Andre', 'Kai', 'Tyrell', 'Isaiah', 'Mateo', 'Riku', 'Pierre', 'Kofi', 'Liam', 'Dante', 'Elijah', 'Oscar', 'Jabari', 'Nico', 'Samson', 'Zane', 'Idris', 'Felix', 'Darius', 'Leon', 'Xavier', 'Troy', 'Hugo', 'Amari', 'Jalen', 'Kato', 'Noel', 'Remy', 'Theo', 'Axel', 'Cyrus', 'Deon', 'Emeka', 'Flynn', 'Gavin', 'Hiro', 'Ivan', 'Jules'];
const LAST_NAMES = ['Thompson', 'Blake', 'Williams', 'Nakamura', 'Dubois', 'Mensah', 'Rodriguez', 'Chen', 'Smith', 'Okafor', 'Mueller', 'Santos', 'Richards', 'Kimura', 'Laurent', 'Osei', 'Garcia', 'Patel', 'Brown', 'Diallo', 'Taylor', 'Sato', 'Martin', 'Owens', 'Nguyen', 'Costa', 'Harper', 'Yamamoto', 'Reid', 'Bakari', 'Fletcher', 'Wagner', 'Cruz', 'Adeyemi', 'Campbell', 'Hoffman', 'Lima', 'Suzuki', 'Fraser', 'Keita'];

const FLAVOR_TEXTS_200 = [
  'Explosive out of the blocks.', 'Pure speed demon.', 'Born to sprint.',
  'Lightning in lanes.', 'The crowd\'s favorite sprinter.', 'Blink and you\'ll miss him.',
];
const FLAVOR_TEXTS_400 = [
  'Master of the one-lap race.', 'Courage on the curve.', 'The ultimate quarter-miler.',
  'Speed meets endurance.', 'Owns the backstretch.', 'Guts and glory.',
];
const FLAVOR_TEXTS_800 = [
  'Tactical genius.', 'Kick like thunder.', 'Two laps of pure grit.',
  'The middle-distance king.', 'Runs with heart.', 'Lethal closing speed.',
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

function generateAthleteTemplates(): AthleteCardTemplate[] {
  const templates: AthleteCardTemplate[] = [];
  const rand = seededRandom(42);
  const rarities: Rarity[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const events: EventType[] = ['200m', '400m', '800m'];
  const flavorByEvent = { '200m': FLAVOR_TEXTS_200, '400m': FLAVOR_TEXTS_400, '800m': FLAVOR_TEXTS_800 };

  let id = 1;
  // Generate cards for each rarity and event
  for (const rarity of rarities) {
    const count = rarity === 'diamond' ? 3 : rarity === 'platinum' ? 5 : rarity === 'gold' ? 8 : rarity === 'silver' ? 10 : 12;
    for (let i = 0; i < count; i++) {
      // Guarantee at least one diamond is an 800m specialist
      const event = (rarity === 'diamond' && i === 0) ? '800m' : events[Math.floor(rand() * events.length)];
      const range = RARITY_STAT_RANGES[rarity];
      const stat = () => Math.floor(range.min + rand() * (range.max - range.min));

      // Specialty: boost relevant stats
      let speed = stat(), stamina = stat(), acceleration = stat(), form = stat();
      if (event === '200m') { speed = Math.min(99, speed + 10); acceleration = Math.min(99, acceleration + 8); }
      if (event === '400m') { speed = Math.min(99, speed + 5); stamina = Math.min(99, stamina + 5); }
      if (event === '800m') { stamina = Math.min(99, stamina + 10); form = Math.min(99, form + 8); }

      const overall = calculateOverallRating({ speed, stamina, acceleration, form });
      const flavors = flavorByEvent[event];

      // Generate a unique name (no duplicates across all templates)
      let fullName: string;
      let nameAttempts = 0;
      const usedNames = new Set(templates.map(t => t.name));
      do {
        const firstName = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
        const lastName = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
        fullName = `${firstName} ${lastName}`;
        nameAttempts++;
      } while (usedNames.has(fullName) && nameAttempts < 100);

      // Assign split type for 800m specialists
      // Extreme types are DIAMOND (legendary) only
      let splitType: SplitType | undefined;
      if (event === '800m') {
        const splitRoll = rand();
        if (rarity === 'diamond') {
          // Legendary: can get any type including extremes
          if (splitRoll < 0.15) splitType = 'extreme_positive';
          else if (splitRoll < 0.35) splitType = 'positive';
          else if (splitRoll < 0.65) splitType = 'basic';
          else if (splitRoll < 0.85) splitType = 'negative';
          else splitType = 'extreme_negative';
        } else if (rarity === 'platinum') {
          // High tier: positive/negative available, no extremes
          if (splitRoll < 0.25) splitType = 'positive';
          else if (splitRoll < 0.65) splitType = 'basic';
          else splitType = 'negative';
        } else if (rarity === 'gold') {
          if (splitRoll < 0.20) splitType = 'positive';
          else if (splitRoll < 0.75) splitType = 'basic';
          else splitType = 'negative';
        } else {
          // Bronze/silver: mostly basic, slight chance of positive/negative
          if (splitRoll < 0.12) splitType = 'positive';
          else if (splitRoll < 0.82) splitType = 'basic';
          else splitType = 'negative';
        }
      }

      templates.push({
        id: id++,
        name: fullName,
        nationality: NATIONALITIES[Math.floor(rand() * NATIONALITIES.length)],
        rarity,
        stats: { speed, stamina, acceleration, form },
        overallRating: overall,
        specialtyEvent: event,
        splitType,
        spriteKey: `runner_${rarity}_${(i % 4) + 1}`,
        flavorText: flavors[Math.floor(rand() * flavors.length)],
      });
    }
  }
  return templates;
}

export const ATHLETE_TEMPLATES: AthleteCardTemplate[] = generateAthleteTemplates();

// ============================================================
// Seed Data: Boost Card Templates (Big Impact Cards)
// ============================================================
export const BOOST_TEMPLATES: BoostCardTemplate[] = [
  {
    id: 1, name: 'Perfect Start', description: 'Explosive acceleration off the blocks! +30% acceleration for the first 15% of the race.',
    rarity: 'silver', effectType: 'perfect_start', effectMagnitude: 0.30, durationPct: 0.15,
    iconKey: 'boost_start', color: '#FFD700',
  },
  {
    id: 2, name: 'Adrenaline Rush', description: 'A surge of pure speed! +20% speed boost for 25% of the race.',
    rarity: 'gold', effectType: 'adrenaline_rush', effectMagnitude: 0.20, durationPct: 0.25,
    iconKey: 'boost_adrenaline', color: '#FF4444',
  },
  {
    id: 3, name: 'Second Wind', description: 'Find reserves of energy! Cancel stamina drain for the last 30% of the race.',
    rarity: 'gold', effectType: 'second_wind', effectMagnitude: 1.0, durationPct: 0.30,
    iconKey: 'boost_wind', color: '#44AAFF',
  },
  {
    id: 4, name: 'Speed Burst', description: 'A quick burst of speed! +15% speed for 10% of the race.',
    rarity: 'bronze', effectType: 'speed_burst', effectMagnitude: 0.15, durationPct: 0.10,
    iconKey: 'boost_speed', color: '#FF8800',
  },
  {
    id: 5, name: 'Intimidate', description: 'Your presence shakes nearby opponents! -10% speed to adjacent lanes for 20% of the race.',
    rarity: 'platinum', effectType: 'intimidate', effectMagnitude: 0.10, durationPct: 0.20,
    iconKey: 'boost_intimidate', color: '#8800FF',
  },
  {
    id: 6, name: 'Draft Surge', description: 'Use the slipstream! +25% speed when behind another runner for 15% of the race.',
    rarity: 'silver', effectType: 'draft_surge', effectMagnitude: 0.25, durationPct: 0.15,
    iconKey: 'boost_draft', color: '#00CC88',
  },
  {
    id: 7, name: 'Iron Legs', description: 'Legs of steel! Complete stamina drain immunity for 40% of the race.',
    rarity: 'platinum', effectType: 'iron_legs', effectMagnitude: 1.0, durationPct: 0.40,
    iconKey: 'boost_iron', color: '#888888',
  },
  {
    id: 8, name: 'Crowd Favorite', description: 'The crowd goes wild! Progressive speed boost that builds to +18% over the race.',
    rarity: 'gold', effectType: 'crowd_favorite', effectMagnitude: 0.18, durationPct: 1.0,
    iconKey: 'boost_crowd', color: '#FF44FF',
  },
  {
    id: 9, name: 'Turbo Start', description: 'Off like a rocket! +20% acceleration at the start.',
    rarity: 'bronze', effectType: 'perfect_start', effectMagnitude: 0.20, durationPct: 0.12,
    iconKey: 'boost_turbo', color: '#FFAA00',
  },
  {
    id: 10, name: 'Final Kick', description: 'An incredible finishing kick! +25% speed for the last 15% of the race.',
    rarity: 'gold', effectType: 'speed_burst', effectMagnitude: 0.25, durationPct: 0.15,
    iconKey: 'boost_kick', color: '#FF2200',
  },
  {
    id: 11, name: 'Zen Focus', description: 'Perfect form and composure. Eliminates all form variance for the entire race.',
    rarity: 'silver', effectType: 'iron_legs', effectMagnitude: 0.5, durationPct: 1.0,
    iconKey: 'boost_zen', color: '#44DDFF',
  },
  {
    id: 12, name: 'Thunder Strike', description: 'BOOM! Massive +35% speed burst for just 5% of the race. Time it right!',
    rarity: 'diamond', effectType: 'speed_burst', effectMagnitude: 0.35, durationPct: 0.05,
    iconKey: 'boost_thunder', color: '#FFFF00',
  },
];

// Boost drop rates per pack rarity
export const BOOST_DROP_RATES: Record<PackType, Record<Rarity, number>> = {
  bronze: { bronze: 0.80, silver: 0.20, gold: 0, platinum: 0, diamond: 0 },
  silver: { bronze: 0.20, silver: 0.50, gold: 0.25, platinum: 0.05, diamond: 0 },
  gold:   { bronze: 0, silver: 0.15, gold: 0.45, platinum: 0.30, diamond: 0.10 },
  boost:  { bronze: 0.15, silver: 0.35, gold: 0.30, platinum: 0.15, diamond: 0.05 },
};
