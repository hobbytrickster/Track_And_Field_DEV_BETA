import {
  RaceSimulationInput,
  RaceSimulationResult,
  RaceFrame,
  RunnerFrame,
  RaceResult,
  SimRunnerInput,
  BoostCardTemplate,
  EventType,
} from './types';
import { SIM, RACE_EVENTS, getLaneStagger } from './constants';

// ============================================================
// Seeded PRNG (Mulberry32)
// ============================================================
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// Simulation Curves
// ============================================================

/**
 * Acceleration curve: runners explode off the line at ~60-75% of top speed,
 * then ramp to 100% over the first few percent of the race.
 * High acceleration stat = higher starting speed and faster ramp.
 */
function accelerationCurve(tickPct: number, accelStat: number, eventType: EventType): number {
  // Starting burst: 0.65 (low accel) to 0.78 (high accel) of top speed
  const startFloor = 0.65 + (accelStat / 100) * 0.13;

  // How quickly they reach full speed (in race-fraction)
  const rampDuration = eventType === '200m' ? 0.04 - (accelStat / 100) * 0.025
    : eventType === '400m' ? 0.03 - (accelStat / 100) * 0.018
    : eventType === '2000mSC' ? 0.008 - (accelStat / 100) * 0.004 // steeplechase: quick settle into pace
    : 0.012 - (accelStat / 100) * 0.006; // 800m: fast ramp, they hit pace quickly

  if (tickPct >= rampDuration) return 1.0;
  const t = tickPct / rampDuration;
  return startFloor + (1 - startFloor) * t * t;
}

/** Stamina curve: 1.0 for first portion, then decays */
function staminaCurve(tickPct: number, staminaStat: number, eventType: EventType, splitType?: string): number {
  if (eventType === '800m') {
    return staminaCurve800(tickPct, staminaStat, splitType || 'basic');
  }
  if (eventType === '2000mSC') {
    return staminaCurve2000SC(tickPct, staminaStat);
  }
  // Longer races punish low stamina more
  const eventMultiplier = eventType === '200m' ? 0.3 : 0.7;
  const decayStart = 0.35 + (staminaStat / 100) * 0.25; // 0.35 to 0.60

  if (tickPct < decayStart) return 1.0;

  const decayProgress = (tickPct - decayStart) / (1 - decayStart);
  const maxDropoff = ((100 - staminaStat) / 100) * 0.20 * eventMultiplier;
  return 1.0 - maxDropoff * decayProgress * decayProgress; // quadratic decay
}

/**
 * 2000m Steeplechase stamina curve.
 * 5-lap race with barriers every lap. Stamina management is crucial.
 * Runners settle into rhythm laps 1-3, fatigue hits lap 4, kick on lap 5.
 */
function staminaCurve2000SC(tickPct: number, staminaStat: number): number {
  // Phase 1: Settle in (0-20% = lap 1)
  if (tickPct < 0.20) return 1.0;

  // Phase 2: Rhythm laps (20-60% = laps 2-3)
  if (tickPct < 0.60) {
    const fatigue = ((100 - staminaStat) / 100) * 0.04 * ((tickPct - 0.20) / 0.40);
    return 1.0 - fatigue;
  }

  // Phase 3: Fatigue sets in (60-80% = lap 4)
  if (tickPct < 0.80) {
    const baseFatigue = ((100 - staminaStat) / 100) * 0.04;
    const extraFatigue = ((100 - staminaStat) / 100) * 0.10 * ((tickPct - 0.60) / 0.20);
    return 1.0 - baseFatigue - extraFatigue;
  }

  // Phase 4: Final lap kick or fade (80-100%)
  const baseFatigue = ((100 - staminaStat) / 100) * 0.04;
  const midFatigue = ((100 - staminaStat) / 100) * 0.10;
  const kickBonus = (staminaStat / 100) * 0.03 * ((tickPct - 0.80) / 0.20);
  const fadePenalty = ((100 - staminaStat) / 100) * 0.06 * ((tickPct - 0.80) / 0.20);
  return 1.0 - baseFatigue - midFatigue + kickBonus - fadePenalty;
}

/**
 * 800m pacing model with split types.
 *
 * Each runner has a pacing style that determines how they distribute energy:
 *
 *   extreme_positive: blazing first lap, dies on second (e.g., 43/59 = 1:42)
 *   positive:         fast first lap, slower second (e.g., 48/54 = 1:42)
 *   basic:            even pacing, slight positive split (e.g., 50/52 = 1:42)
 *   negative:         slow first lap, fast second (e.g., 53/49 = 1:42)
 *   extreme_negative: very slow first lap, blazing second (e.g., 58/44 = 1:42)
 *
 * The total time is similar — the split type changes the speed distribution,
 * not the overall ability.
 */
function staminaCurve800(tickPct: number, staminaStat: number, splitType: string): number {
  // Split type parameters:
  // lap1Boost: how much faster (positive) or slower (negative) than baseline on lap 1
  // lap2Drop: how much the speed drops on lap 2 (higher = more fade)
  // kickStrength: finishing kick ability
  let lap1Boost: number;   // speed multiplier for first lap (>1 = faster, <1 = slower)
  let lap2Drop: number;    // speed drop percentage for second lap
  let kickStrength: number; // how strong the finishing kick is

  switch (splitType) {
    case 'extreme_positive':
      lap1Boost = 1.10;     // 10% faster first lap
      lap2Drop = 0.25 + ((100 - staminaStat) / 100) * 0.10;  // massive drop
      kickStrength = -0.02; // no kick, actually fades more
      break;
    case 'positive':
      lap1Boost = 1.04;     // 4% faster first lap
      lap2Drop = 0.14 + ((100 - staminaStat) / 100) * 0.07;
      kickStrength = 0.01;
      break;
    case 'negative':
      lap1Boost = 0.95;     // 5% slower first lap (saving energy)
      lap2Drop = 0.03 + ((100 - staminaStat) / 100) * 0.04;  // barely drops
      kickStrength = 0.05;  // strong kick
      break;
    case 'extreme_negative':
      lap1Boost = 0.90;     // 10% slower first lap
      lap2Drop = 0.0;       // no drop at all
      kickStrength = 0.10;  // huge finishing kick
      break;
    default: // basic
      lap1Boost = 1.0;
      lap2Drop = 0.08 + ((100 - staminaStat) / 100) * 0.07;
      kickStrength = (staminaStat / 100) * 0.02;
      break;
  }

  // Phase 1: First lap (0-48%)
  if (tickPct < 0.48) {
    return lap1Boost;
  }

  // Phase 2: Transition (48-60%)
  if (tickPct < 0.60) {
    const t = (tickPct - 0.48) / 0.12;
    const targetSpeed = 1.0 - lap2Drop;
    return lap1Boost + (targetSpeed - lap1Boost) * t;
  }

  // Phase 3: Second lap grind (60-85%)
  if (tickPct < 0.85) {
    const grindExtra = ((100 - staminaStat) / 100) * 0.04 * ((tickPct - 0.60) / 0.25);
    return 1.0 - lap2Drop - grindExtra;
  }

  // Phase 4: Final kick or fade (85-100%)
  const finalT = (tickPct - 0.85) / 0.15;
  const grindExtra = ((100 - staminaStat) / 100) * 0.04;
  const fadeFactor = ((100 - staminaStat) / 100) * 0.05 * finalT;
  return 1.0 - lap2Drop - grindExtra + kickStrength * finalT - fadeFactor;
}

/**
 * Form noise + "bad day" mechanic.
 *
 * Every runner has per-tick variance based on form stat, PLUS a race-wide
 * "day factor" that simulates good days and bad days. Even a diamond athlete
 * can have an off race where they run 10-15% slower than their best.
 */
function formNoise(rand: () => number, formStat: number): number {
  const amplitude = ((100 - formStat) / 100) * 0.08; // per-tick noise: 0 to 8%
  return 1.0 + (rand() - 0.5) * 2 * amplitude;
}

/**
 * Race-wide performance factor — rolled once per runner per race.
 *
 * Better athletes (higher overallRating) are more consistent:
 *   - Bronze (OVR ~30): 12% terrible, 20% bad, 40% normal, 28% good
 *   - Diamond (OVR ~90): 3% terrible, 8% bad, 50% normal, 39% good
 *
 * The floor is also higher for better cards:
 *   - Bronze terrible day: 0.82 (18% slower)
 *   - Diamond terrible day: 0.90 (10% slower)
 */
function raceDayFactor(rand: () => number, formStat: number, overallRating: number = 50): number {
  const roll = rand();
  // Quality factor: 0 (worst bronze) to 1 (best diamond)
  const q = Math.min(1, overallRating / 100);

  // Probability thresholds shift with quality
  const terribleChance = 0.12 - q * 0.09;  // 12% (bronze) → 3% (diamond)
  const badChance = terribleChance + (0.20 - q * 0.12); // +20% (bronze) → +8% (diamond)
  const normalChance = badChance + (0.40 + q * 0.10); // +40% (bronze) → +50% (diamond)
  // Good day = remainder

  // Floor: how bad a terrible day can be
  const consistencyFloor = 0.82 + q * 0.08 + (formStat / 100) * 0.04; // 0.82-0.94

  if (roll < terribleChance) {
    return consistencyFloor;
  } else if (roll < badChance) {
    const t = (roll - terribleChance) / (badChance - terribleChance);
    return consistencyFloor + (0.95 - consistencyFloor) * t;
  } else if (roll < normalChance) {
    const t = (roll - badChance) / (normalChance - badChance);
    return 0.95 + t * 0.05; // 0.95 to 1.00
  } else {
    const t = (roll - normalChance) / (1 - normalChance);
    return 1.00 + t * 0.02; // 1.00 to 1.02
  }
}

// ============================================================
// Boost Effect Calculator
// ============================================================
interface ActiveBoost {
  template: BoostCardTemplate;
  startPct: number;
  endPct: number;
}

function calculateBoostMultiplier(
  tickPct: number,
  boosts: ActiveBoost[],
  lane: number,
  allRunners: RunnerState[],
): { speedMult: number; accelMult: number; staminaMult: number; activeNames: string[] } {
  let speedMult = 1.0;
  let accelMult = 1.0;
  let staminaMult = 1.0;
  const activeNames: string[] = [];

  for (const boost of boosts) {
    const { template, startPct, endPct } = boost;
    if (tickPct < startPct || tickPct > endPct) continue;

    activeNames.push(template.name);
    const progressInBoost = (tickPct - startPct) / (endPct - startPct);

    switch (template.effectType) {
      case 'speed_burst':
        speedMult += template.effectMagnitude;
        break;
      case 'perfect_start':
        accelMult += template.effectMagnitude;
        break;
      case 'second_wind':
        staminaMult = 999; // effectively cancel stamina drain
        break;
      case 'adrenaline_rush':
        speedMult += template.effectMagnitude;
        break;
      case 'iron_legs':
        staminaMult = 999;
        break;
      case 'crowd_favorite':
        // Progressive: builds over the race
        speedMult += template.effectMagnitude * progressInBoost;
        break;
      case 'draft_surge': {
        // Only active when behind someone
        const runner = allRunners.find(r => r.lane === lane);
        const ahead = allRunners.some(r => r.lane !== lane && r.distance > (runner?.distance ?? 0) && r.distance - (runner?.distance ?? 0) < 5);
        if (ahead) speedMult += template.effectMagnitude;
        break;
      }
      case 'intimidate': {
        // Apply debuff to adjacent lanes (handled separately)
        break;
      }
    }
  }

  // Cap total boost multiplier — boosts are helpful but can't break the game
  speedMult = Math.min(speedMult, 1.12);  // max +12% speed from all boosts combined
  accelMult = Math.min(accelMult, 1.20);  // max +20% acceleration

  return { speedMult, accelMult, staminaMult, activeNames };
}

function calculateIntimidateDebuff(
  tickPct: number,
  lane: number,
  allRunnerBoosts: Map<number, ActiveBoost[]>,
): number {
  let debuff = 0;
  for (const [otherLane, boosts] of allRunnerBoosts) {
    if (Math.abs(otherLane - lane) !== 1) continue; // only adjacent lanes
    for (const boost of boosts) {
      if (boost.template.effectType !== 'intimidate') continue;
      if (tickPct >= boost.startPct && tickPct <= boost.endPct) {
        debuff += boost.template.effectMagnitude;
      }
    }
  }
  return debuff;
}

// ============================================================
// Runner State
// ============================================================
interface RunnerState {
  lane: number;
  distance: number;
  speed: number;
  finished: boolean;
  finishTick: number;
  displayName: string;
}

// ============================================================
// Main Simulation
// ============================================================
export function simulateRace(input: RaceSimulationInput): RaceSimulationResult {
  const { eventType, runners: runnerInputs, seed } = input;
  const raceConfig = RACE_EVENTS[eventType];
  const raceDistance = raceConfig.distance;
  const tickRate = SIM.tickRate;

  // Estimate max ticks — use slowest possible speed for the event
  const slowestSpeed = eventType === '2000mSC' ? 4.0 : eventType === '800m' ? 5.0 : eventType === '400m' ? 6.0 : SIM.minSpeedMs;
  const maxTicks = Math.ceil((raceDistance / slowestSpeed) * tickRate * 1.5);

  // Initialize runners
  const runners: RunnerState[] = runnerInputs.map(r => ({
    lane: r.lane,
    distance: 0,
    speed: 0,
    finished: false,
    finishTick: -1,
    displayName: r.displayName,
  }));

  // Set up per-runner RNG, boosts, and race-day factor
  const rngMap = new Map<number, () => number>();
  const boostMap = new Map<number, ActiveBoost[]>();
  const dayFactorMap = new Map<number, number>();

  for (const ri of runnerInputs) {
    const rng = mulberry32(seed + ri.lane * 7919);
    rngMap.set(ri.lane, rng);
    // Roll the "day factor" once per runner per race
    dayFactorMap.set(ri.lane, raceDayFactor(rng, ri.stats.form, ri.overallRating));

    // Assign boost timing (max 1 boost per runner)
    const activeBoosts: ActiveBoost[] = [];
    for (const boost of ri.boosts.slice(0, 1)) {
      let startPct: number;
      switch (boost.effectType) {
        case 'perfect_start':
          startPct = 0;
          break;
        case 'second_wind':
          startPct = 1.0 - boost.durationPct;
          break;
        case 'crowd_favorite':
          startPct = 0;
          break;
        case 'adrenaline_rush':
          startPct = 0.4; // mid-race
          break;
        case 'speed_burst':
          // If it's a "Final Kick" style (late duration), apply late
          if (boost.name.includes('Final') || boost.name.includes('Kick')) {
            startPct = 1.0 - boost.durationPct;
          } else if (boost.name.includes('Thunder')) {
            startPct = 0.6; // thunder strike mid-late
          } else {
            startPct = 0.3;
          }
          break;
        case 'draft_surge':
          startPct = 0.3;
          break;
        case 'intimidate':
          startPct = 0.2;
          break;
        case 'iron_legs':
          startPct = 0.5;
          break;
        default:
          startPct = 0.3;
      }
      activeBoosts.push({
        template: boost,
        startPct,
        endPct: Math.min(1.0, startPct + boost.durationPct),
      });
    }
    boostMap.set(ri.lane, activeBoosts);
  }

  // Run simulation
  const frames: RaceFrame[] = [];
  let allFinished = false;
  let tick = 0;

  while (!allFinished && tick < maxTicks) {
    const tickPct = Math.min(1, tick / (maxTicks * 0.6)); // Approximate race progress
    const runnerFrames: RunnerFrame[] = [];

    for (const ri of runnerInputs) {
      const state = runners.find(r => r.lane === ri.lane)!;
      const rand = rngMap.get(ri.lane)!;

      if (state.finished) {
        runnerFrames.push({
          lane: state.lane,
          distance: raceDistance,
          speed: 0,
          progress: 1,
          activeBoosts: [],
          finished: true,
          finishTimeMs: Math.round((state.finishTick / tickRate) * 1000),
        });
        continue;
      }

      // Use base stats with out-of-specialty penalties.
      // Running outside your specialty hurts specific stats:
      //   Sprinter (200m) in 800m: stamina tanks, form drops (they can't pace)
      //   Sprinter (200m) in 400m: slight stamina penalty
      //   Middle-dist (800m) in 200m: speed/acceleration drop (not explosive enough)
      //   Middle-dist (800m) in 400m: slight speed penalty
      //   400m in 200m: slight acceleration penalty
      //   400m in 800m: slight stamina penalty
      const specialty = ri.specialtyEvent || eventType;
      let speedPenalty = 0, staminaPenalty = 0, accelPenalty = 0, formPenalty = 0;

      if (specialty !== eventType) {
        const order = { '200m': 0, '400m': 1, '800m': 2, '2000mSC': 3 } as Record<string, number>;
        const gap = Math.abs((order[specialty] ?? 0) - (order[eventType] ?? 0));

        if (specialty === '200m' && eventType === '800m') {
          staminaPenalty = 55; formPenalty = 45; speedPenalty = 20; accelPenalty = 10;
        } else if (specialty === '800m' && eventType === '200m') {
          speedPenalty = 50; accelPenalty = 55; formPenalty = 15;
        } else if (specialty === '200m' && eventType === '400m') {
          staminaPenalty = 40; formPenalty = 25; speedPenalty = 10;
        } else if (specialty === '400m' && eventType === '200m') {
          accelPenalty = 35; speedPenalty = 30; formPenalty = 10;
        } else if (specialty === '400m' && eventType === '800m') {
          staminaPenalty = 45; formPenalty = 30; speedPenalty = 10;
        } else if (specialty === '800m' && eventType === '400m') {
          speedPenalty = 40; accelPenalty = 35; formPenalty = 10;
        // 2000mSC penalties — steeplechase specialists need endurance + barrier technique
        } else if (specialty === '200m' && eventType === '2000mSC') {
          staminaPenalty = 60; formPenalty = 50; speedPenalty = 25; accelPenalty = 15;
        } else if (specialty === '400m' && eventType === '2000mSC') {
          staminaPenalty = 50; formPenalty = 40; speedPenalty = 15;
        } else if (specialty === '800m' && eventType === '2000mSC') {
          staminaPenalty = 20; formPenalty = 25; // 800m runners can adapt somewhat
        } else if (specialty === '2000mSC' && eventType === '200m') {
          speedPenalty = 55; accelPenalty = 60; formPenalty = 20;
        } else if (specialty === '2000mSC' && eventType === '400m') {
          speedPenalty = 45; accelPenalty = 40; formPenalty = 15;
        } else if (specialty === '2000mSC' && eventType === '800m') {
          speedPenalty = 20; accelPenalty = 15; // steepler in 800m is decent
        }
      }

      const effectiveStats = {
        speed: Math.max(10, Math.min(99, ri.stats.speed - speedPenalty)),
        stamina: Math.max(10, Math.min(99, ri.stats.stamina - staminaPenalty)),
        acceleration: Math.max(10, Math.min(99, ri.stats.acceleration - accelPenalty)),
        form: Math.max(10, Math.min(99, ri.stats.form - formPenalty)),
      };

      // Current race progress for this runner
      const runnerPct = state.distance / raceDistance;

      // Base top speed (scaled by speed stat)
      // Graduated speed by tier — Super Stars are the fastest, lower tiers nerfed slightly
      // OVR ranges: bronze 15-35, silver 36-50, gold 51-65, platinum 66-78, diamond 79-90, superstar 96-100
      let minSpeed: number, maxSpeed: number;
      if (eventType === '2000mSC') {
        minSpeed = 4.8;
        maxSpeed = 6.8; // ~4:54 to ~6:57 for 2000m
      } else if (eventType === '800m') {
        minSpeed = 5.6;
        maxSpeed = 7.8;
      } else if (eventType === '400m') {
        minSpeed = 5.5;
        maxSpeed = 9.2;
      } else {
        minSpeed = 7.2;
        maxSpeed = 10.2;
      }

      // Graduated tier multiplier — Legends/Super Stars at 1.0, others nerfed
      const ovr = ri.overallRating;
      let tierMult: number;
      if (ovr >= 100)     tierMult = 1.01;  // Legend — slight edge
      else if (ovr >= 96) tierMult = 1.00;  // Super Star — full speed
      else if (ovr >= 79) tierMult = 0.94;  // Diamond — -6%
      else if (ovr >= 66) tierMult = 0.95;  // Platinum — -5%
      else if (ovr >= 51) tierMult = 0.97;  // Gold — -3%
      else                tierMult = 1.00;  // Bronze/Silver — unchanged

      const topSpeed = (minSpeed + (effectiveStats.speed / 100) * (maxSpeed - minSpeed)) * tierMult;

      // Apply curves
      const accelFactor = accelerationCurve(runnerPct, effectiveStats.acceleration, eventType);
      const staminaFactor = staminaCurve(runnerPct, effectiveStats.stamina, eventType, ri.splitType);
      const formFactor = formNoise(rand, effectiveStats.form);

      // Apply boosts
      const boostResult = calculateBoostMultiplier(runnerPct, boostMap.get(ri.lane) || [], ri.lane, runners);
      const intimidateDebuff = calculateIntimidateDebuff(runnerPct, ri.lane, boostMap);

      // Effective stamina with boost
      const effectiveStamina = boostResult.staminaMult > 100 ? 1.0 : staminaFactor;

      // Calculate speed this tick
      const dayFactor = dayFactorMap.get(ri.lane) || 1.0;

      let currentSpeed = topSpeed
        * accelFactor
        * effectiveStamina
        * formFactor
        * dayFactor
        * (boostResult.speedMult)
        * (boostResult.accelMult > 1 && runnerPct < 0.15 ? boostResult.accelMult : 1)
        * (1 - intimidateDebuff);

      // Steeplechase barrier slowdown — 5 barriers per lap at fixed positions
      // Higher form stat = better technique = less speed loss
      if (eventType === '2000mSC') {
        const lapLength = 400;
        // H1=right curve, H2=top straight R, H3=top straight L, H4=water jump (left curve), H5=bottom straight
        const barrierPositions = [35, 115, 195, 243, 355]; // ~80m apart, H1 at 35m, water at 243m
        const distInLap = state.distance % lapLength;
        for (const bp of barrierPositions) {
          // H1 (35m) is skipped on the first lap
          if (bp === 35 && state.distance < lapLength) continue;
          const prevDistInLap = (state.distance - (state.speed / tickRate)) % lapLength;
          if ((prevDistInLap < bp && distInLap >= bp) || (prevDistInLap > 370 && distInLap < 30 && bp < 30)) {
            const isWaterJump = bp === 243;
            const formFactor2 = effectiveStats.form / 100;
            const maxSlow = isWaterJump ? 0.20 : 0.10;
            const minSlow = isWaterJump ? 0.08 : 0.03;
            const slowdown = maxSlow - formFactor2 * (maxSlow - minSlow);
            currentSpeed *= (1 - slowdown);
            break;
          }
        }
      }

      // Hard speed caps per event — prevents boosts from breaking target times
      // 200m target: fastest ~19.5s → max avg ~10.25 m/s → cap at 10.4
      // 400m target: fastest ~43s → max avg ~9.30 m/s → cap at 9.5
      // 800m target: fastest ~1:39 → max avg ~8.08 m/s → cap at 8.3
      const hardCap = eventType === '2000mSC' ? 7.2 : eventType === '800m' ? 8.05 : eventType === '400m' ? 9.5 : 10.4;
      currentSpeed = Math.min(currentSpeed, hardCap);

      // Update position
      state.speed = Math.max(0, currentSpeed);
      state.distance += state.speed / tickRate;

      // Check finish
      if (state.distance >= raceDistance) {
        state.distance = raceDistance;
        state.finished = true;
        state.finishTick = tick;
      }

      runnerFrames.push({
        lane: state.lane,
        distance: state.distance,
        speed: state.speed,
        progress: state.distance / raceDistance,
        activeBoosts: boostResult.activeNames,
        finished: state.finished,
        finishTimeMs: state.finished ? Math.round((tick / tickRate) * 1000) : undefined,
      });
    }

    frames.push({ tick, runners: runnerFrames });
    allFinished = runners.every(r => r.finished);
    tick++;
  }

  // Build results sorted by finish time
  const results: RaceResult[] = runners
    .filter(r => r.finished)
    .sort((a, b) => a.finishTick - b.finishTick)
    .map((r, i) => ({
      lane: r.lane,
      displayName: r.displayName,
      finishTimeMs: Math.round((r.finishTick / tickRate) * 1000),
      finishPosition: i + 1,
    }));

  // Add DNF runners
  for (const r of runners) {
    if (!r.finished) {
      results.push({
        lane: r.lane,
        displayName: r.displayName,
        finishTimeMs: 999999,
        finishPosition: results.length + 1,
      });
    }
  }

  return {
    frames,
    results,
    totalTicks: tick,
    eventType,
  };
}
