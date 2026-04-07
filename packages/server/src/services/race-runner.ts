import { v4 as uuid } from 'uuid';
import { getDb, saveDb } from '../db';
import {
  EventType,
  SplitType,
  SimRunnerInput,
  BoostCardTemplate,
  ATHLETE_TEMPLATES,
  BOOST_TEMPLATES,
  calculateOverallRating,
  simulateRace,
  ECONOMY,
  RaceSimulationResult,
} from '@track-stars/shared';

interface RaceRequest {
  userId: string;
  eventType: EventType;
  userAthleteId: string;
  boostIds: string[];
}

function generateBotRunner(lane: number, targetRating: number, eventType: EventType): SimRunnerInput {
  const botNames = [
    'CPU Flash', 'Bot Bolt', 'AI Sprinter', 'Cyber Runner', 'Digi Dash',
    'Neon Streak', 'Pixel Pacer', 'Robo Racer', 'Tech Strider', 'Virtual Velocity',
  ];

  const variance = 12;
  const baseStat = Math.max(20, Math.min(75, targetRating));
  const stat = () => Math.max(15, Math.min(90, baseStat + Math.floor((Math.random() - 0.5) * variance * 2)));

  let speed = stat(), stamina = stat(), acceleration = stat(), form = stat();
  if (eventType === '200m') { speed = Math.min(90, speed + 5); acceleration = Math.min(90, acceleration + 3); }
  if (eventType === '400m') { speed = Math.min(90, speed + 3); stamina = Math.min(90, stamina + 3); }
  if (eventType === '800m') {
    // 800m bots are middle-distance runners — high stamina/form, moderate speed
    stamina = Math.min(90, stamina + 8); form = Math.min(90, form + 5);
    speed = Math.min(75, speed); // cap speed lower — they're not sprinters
  }

  const botBoosts: BoostCardTemplate[] = [];
  if (Math.random() < 0.4) {
    botBoosts.push(BOOST_TEMPLATES[Math.floor(Math.random() * BOOST_TEMPLATES.length)]);
  }

  // Random split type for 800m bots
  let splitType: SplitType | undefined;
  if (eventType === '800m') {
    const splitTypes: SplitType[] = ['extreme_positive', 'positive', 'basic', 'basic', 'basic', 'negative', 'extreme_negative'];
    splitType = splitTypes[Math.floor(Math.random() * splitTypes.length)];
  }

  return {
    lane,
    displayName: botNames[lane - 1] || `Bot ${lane}`,
    stats: { speed, stamina, acceleration, form },
    bonusStats: { speed: 0, stamina: 0, acceleration: 0, form: 0 },
    boosts: botBoosts,
    splitType,
    specialtyEvent: eventType, // bots always specialize in the race they're in
    overallRating: calculateOverallRating({ speed, stamina, acceleration, form }),
  };
}

export function runRace(request: RaceRequest): {
  simulation: RaceSimulationResult;
  raceId: string;
  rewards: { coinsEarned: number; xpEarned: number };
} {
  const db = getDb();
  const { userId, eventType, userAthleteId, boostIds } = request;

  const athleteRow = db.userAthletes.find(a => a.id === userAthleteId && a.userId === userId);
  if (!athleteRow) throw new Error('Athlete not found');

  const template = ATHLETE_TEMPLATES.find(t => t.id === athleteRow.cardId);
  if (!template) throw new Error('Athlete template not found');

  const user = db.users.find(u => u.id === userId);
  if (!user) throw new Error('User not found');

  // Get boosts and consume them
  const userBoosts: BoostCardTemplate[] = [];
  for (const bid of boostIds) {
    const ub = db.userBoosts.find(b => b.id === bid && b.userId === userId && b.quantity > 0);
    if (ub) {
      const bt = BOOST_TEMPLATES.find(t => t.id === ub.boostCardId);
      if (bt) {
        userBoosts.push(bt);
        ub.quantity -= 1;
        if (ub.quantity <= 0) {
          db.userBoosts = db.userBoosts.filter(b => b.id !== bid);
        }
      }
    }
  }

  // Random lane assignment for the player
  const playerLane = Math.floor(Math.random() * 8) + 1;

  const playerRunner: SimRunnerInput = {
    lane: playerLane,
    displayName: user.displayName,
    stats: template.stats,
    bonusStats: {
      speed: athleteRow.speedBonus,
      stamina: athleteRow.staminaBonus,
      acceleration: athleteRow.accelerationBonus,
      form: athleteRow.formBonus,
    },
    boosts: userBoosts,
    overallRating: template.overallRating,
    splitType: template.splitType,
    specialtyEvent: template.specialtyEvent,
  };

  const runners: SimRunnerInput[] = [];
  for (let i = 1; i <= 8; i++) {
    if (i === playerLane) {
      runners.push(playerRunner);
    } else {
      runners.push(generateBotRunner(i, template.overallRating + Math.floor((Math.random() - 0.5) * 20), eventType));
    }
  }

  const simulation = simulateRace({ raceId: uuid(), eventType, runners, seed: Date.now() });

  // Save race
  const raceId = uuid();
  db.races.push({
    id: raceId, eventType, status: 'complete',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });

  for (const result of simulation.results) {
    db.raceParticipants.push({
      id: uuid(), raceId,
      userId: result.lane === playerLane ? userId : 'bot',
      displayName: result.displayName,
      userAthleteId: result.lane === playerLane ? userAthleteId : undefined,
      lane: result.lane,
      finishTimeMs: result.finishTimeMs,
      finishPosition: result.finishPosition,
    });
  }

  // Save every race time for the player (keep top 10 per user per event)
  const playerResult = simulation.results.find(r => r.lane === playerLane);
  if (playerResult && playerResult.finishTimeMs < 999999) {
    if (!db.records) db.records = [];
    db.records.push({
      eventType,
      finishTimeMs: playerResult.finishTimeMs,
      displayName: user.displayName,
      userId,
      raceId,
      setAt: new Date().toISOString(),
    });
    // Keep only top 10 per user per event
    const userEventRecords = db.records
      .filter(r => r.eventType === eventType && r.userId === userId)
      .sort((a, b) => a.finishTimeMs - b.finishTimeMs);
    if (userEventRecords.length > 10) {
      const keep = new Set(userEventRecords.slice(0, 10).map(r => r.raceId + r.finishTimeMs));
      db.records = db.records.filter(r =>
        !(r.eventType === eventType && r.userId === userId) ||
        keep.has(r.raceId + r.finishTimeMs)
      );
    }
  }

  // Rewards
  const pos = playerResult?.finishPosition ?? 99;
  let coinsEarned = pos === 1 ? ECONOMY.winReward : (pos <= 3 ? ECONOMY.loseReward + ECONOMY.podiumReward : ECONOMY.loseReward);
  const xpEarned = pos === 1 ? ECONOMY.winXP : ECONOMY.loseXP;

  // Daily first race bonus
  const today = new Date().toISOString().slice(0, 10);
  if (user.lastRaceDate !== today) {
    coinsEarned += ECONOMY.dailyFirstRaceBonus;
    user.lastRaceDate = today;
  }

  user.coins += coinsEarned;
  user.xp += xpEarned;
  if (pos === 1) user.wins++; else user.losses++;

  if (user.xp >= user.level * ECONOMY.xpPerLevel) {
    user.level++;
    user.xp = 0;
    user.coins += ECONOMY.levelUpBonus;
  }

  saveDb();

  return { simulation, raceId, playerLane, rewards: { coinsEarned, xpEarned } };
}

// ═══════════════════════════════════════════════════════════
// Challenge Race — mixed real players + bots
// ═══════════════════════════════════════════════════════════

export function runChallengeRace(challengeId: string): RaceSimulationResult {
  const db = getDb();
  const challenge = db.challenges.find(c => c.id === challengeId);
  if (!challenge) throw new Error('Challenge not found');

  const eventType = challenge.eventType as EventType;
  const entries = (db.challengeEntries || []).filter(e => e.challengeId === challengeId && e.status === 'submitted');

  // Build runner inputs for human players
  const runners: SimRunnerInput[] = [];
  const usedLanes = new Set<number>();
  let totalRating = 0;

  for (const entry of entries) {
    const athleteRow = db.userAthletes.find(a => a.id === entry.userAthleteId);
    if (!athleteRow) continue;
    const template = ATHLETE_TEMPLATES.find(t => t.id === athleteRow.cardId);
    if (!template) continue;
    const user = db.users.find(u => u.id === entry.userId);
    if (!user) continue;

    // Resolve boosts
    const boosts: BoostCardTemplate[] = [];
    for (const bid of entry.boostIds) {
      const bt = BOOST_TEMPLATES.find(t => {
        const ub = db.userBoosts.find(b => b.id === bid);
        return ub && t.id === ub.boostCardId;
      });
      if (bt) boosts.push(bt);
    }

    runners.push({
      lane: entry.lane,
      displayName: user.displayName,
      stats: template.stats,
      bonusStats: { speed: athleteRow.speedBonus, stamina: athleteRow.staminaBonus, acceleration: athleteRow.accelerationBonus, form: athleteRow.formBonus },
      boosts,
      overallRating: template.overallRating,
      splitType: template.splitType,
      specialtyEvent: template.specialtyEvent,
    });
    usedLanes.add(entry.lane);
    totalRating += template.overallRating;
  }

  // Track per-lane metadata for consistent display across both players
  const laneMetadata: Record<number, { displayName: string; isHuman: boolean; userId?: string; appearance?: any }> = {};

  // Record human player metadata
  for (const entry of entries) {
    const athleteRow = db.userAthletes.find(a => a.id === entry.userAthleteId);
    const user = db.users.find(u => u.id === entry.userId);
    laneMetadata[entry.lane] = {
      displayName: user?.displayName || 'Player',
      isHuman: true,
      userId: entry.userId,
      appearance: athleteRow?.appearance || null,
    };
  }

  // Fill remaining lanes with bots (use seeded random for consistent appearances)
  const avgRating = entries.length > 0 ? totalRating / entries.length : 50;
  const BOT_HAIR_COLORS = [0x222222, 0x4a3000, 0x8B4513, 0xDAA520, 0xCC3300, 0x888888, 0x111111];
  const BOT_JERSEY = [0xff4444, 0x4488ff, 0x44cc44, 0xffaa00, 0xff44ff, 0x00ddaa, 0x2244aa, 0xcc0000];
  const BOT_SHORTS = [0x222244, 0x000000, 0x222222, 0x002244, 0x440022, 0x333333];
  const BOT_SHOES = [0x222222, 0xffffff, 0xff0000, 0x0044ff, 0x00cc00, 0xffaa00];

  for (let lane = 1; lane <= 8; lane++) {
    if (usedLanes.has(lane)) continue;
    runners.push(generateBotRunner(lane, avgRating + Math.floor((Math.random() - 0.5) * 15), eventType));
    // Deterministic bot appearance based on challenge seed + lane
    const bs = challenge.seed + lane * 137;
    laneMetadata[lane] = {
      displayName: runners[runners.length - 1].displayName,
      isHuman: false,
      appearance: {
        skinTone: (bs * 3) % 6,
        hairStyle: [0, 1, 2, 4, 5, 0, 1, 2][(bs * 7) % 8],
        hairColor: BOT_HAIR_COLORS[(bs * 11) % BOT_HAIR_COLORS.length],
        jerseyColor: BOT_JERSEY[(bs * 13) % BOT_JERSEY.length],
        shortsColor: BOT_SHORTS[(bs * 17) % BOT_SHORTS.length],
        shoeColor: BOT_SHOES[(bs * 19) % BOT_SHOES.length],
        accessory: 0,
      },
    };
  }

  // Sort by lane
  runners.sort((a, b) => a.lane - b.lane);

  // Run simulation
  const simulation = simulateRace({
    raceId: challengeId,
    eventType,
    runners,
    seed: challenge.seed,
  });

  // Store result with lane metadata for consistent display
  challenge.simulationResult = JSON.stringify({ ...simulation, laneMetadata });
  challenge.status = 'simulated';

  // Cleanup: remove old simulated challenges between these players, keep only this one
  const playerIds = entries.map(e => e.userId).sort();
  const oldChallenges = db.challenges.filter(c =>
    c.id !== challengeId && c.status === 'simulated' &&
    (() => {
      const cEntries = (db.challengeEntries || []).filter(e => e.challengeId === c.id && e.status === 'submitted');
      const cPlayerIds = cEntries.map(e => e.userId).sort();
      return cPlayerIds.length === playerIds.length && cPlayerIds.every((id, i) => id === playerIds[i]);
    })()
  );
  for (const old of oldChallenges) {
    db.challengeEntries = db.challengeEntries.filter(e => e.challengeId !== old.id);
    db.challenges = db.challenges.filter(c => c.id !== old.id);
  }
  challenge.completedAt = new Date().toISOString();

  // Award rewards to human players
  for (const entry of entries) {
    const user = db.users.find(u => u.id === entry.userId);
    if (!user) continue;
    const result = simulation.results.find(r => r.lane === entry.lane);
    if (!result) continue;
    const pos = result.finishPosition;
    let coinsEarned = pos === 1 ? ECONOMY.winReward : (pos <= 3 ? ECONOMY.loseReward + ECONOMY.podiumReward : ECONOMY.loseReward);
    const xpEarned = pos === 1 ? ECONOMY.winXP : ECONOMY.loseXP;

    // Daily first race bonus
    const today = new Date().toISOString().slice(0, 10);
    if (user.lastRaceDate !== today) {
      coinsEarned += ECONOMY.dailyFirstRaceBonus;
      user.lastRaceDate = today;
    }

    user.coins += coinsEarned;
    user.xp += xpEarned;
    if (pos === 1) user.wins++; else user.losses++;
    if (user.xp >= user.level * ECONOMY.xpPerLevel) {
      user.level++;
      user.xp = 0;
      user.coins += ECONOMY.levelUpBonus;
    }

    // Save race time (keep top 10 per user per event)
    if (result.finishTimeMs < 999999) {
      if (!db.records) db.records = [];
      db.records.push({
        eventType, finishTimeMs: result.finishTimeMs,
        displayName: user.displayName, userId: entry.userId,
        raceId: challengeId, setAt: new Date().toISOString(),
      });
      const userEventRecs = db.records
        .filter(r => r.eventType === eventType && r.userId === entry.userId)
        .sort((a, b) => a.finishTimeMs - b.finishTimeMs);
      if (userEventRecs.length > 10) {
        const keep = new Set(userEventRecs.slice(0, 10).map(r => r.raceId + r.finishTimeMs));
        db.records = db.records.filter(r =>
          !(r.eventType === eventType && r.userId === entry.userId) ||
          keep.has(r.raceId + r.finishTimeMs)
        );
      }
    }
  }

  saveDb();
  return simulation;
}
