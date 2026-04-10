// ============================================================
// Track Stars - Shared Types
// ============================================================

// --- User ---
export interface User {
  id: string;
  email: string;
  displayName: string;
  coins: number;
  level: number;
  xp: number;
  createdAt: string;
}

export interface AuthPayload {
  token: string;
  user: User;
}

// --- Athlete Cards ---
export type EventType = '200m' | '400m' | '800m' | '2000mSC';
export type Rarity = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'superstar' | 'legend';

/** 800m pacing style — determines how the runner distributes effort across laps */
export type SplitType =
  | 'extreme_positive'  // very fast first lap, very slow second (e.g., 43/59)
  | 'positive'          // faster first lap than second (e.g., 48/54)
  | 'basic'             // even pacing, slight positive split (e.g., 50/52)
  | 'negative'          // faster second lap than first (e.g., 53/49)
  | 'extreme_negative'; // very slow first lap, very fast second (e.g., 58/44)

export interface AthleteStats {
  speed: number;       // 1-100: top speed capability
  stamina: number;     // 1-100: endurance over distance
  acceleration: number; // 1-100: how fast they reach top speed
  form: number;        // 1-100: consistency (high = less variance)
}

export interface AthleteCardTemplate {
  id: number;
  name: string;
  nationality: string;
  rarity: Rarity;
  stats: AthleteStats;
  overallRating: number;   // 1-100 overall rating
  specialtyEvent: EventType;
  splitType?: SplitType;   // only for 800m specialists
  spriteKey: string;
  flavorText: string;
}

export interface UserAthlete {
  id: string;
  userId: string;
  cardId: number;
  template: AthleteCardTemplate;
  level: number;
  xp: number;
  bonusStats: AthleteStats;  // from leveling
}

// --- Performance Boosts (permanent stat items) ---
export interface PerfBoostTemplate {
  id: number;
  name: string;
  description: string;
  rarity: Rarity;
  statBoosts: AthleteStats; // speed, stamina, acceleration, form bonuses
  iconKey: string;  // emoji or icon identifier
  color: string;
}

// --- Boost / Big Impact Cards ---
export type BoostEffectType =
  | 'speed_burst'        // Temporary speed increase
  | 'perfect_start'      // Massive acceleration boost at start
  | 'second_wind'        // Cancel stamina drain late race
  | 'adrenaline_rush'    // Big speed boost mid-race
  | 'intimidate'         // Slow down nearby opponents
  | 'draft_surge'        // Speed boost when behind another runner
  | 'iron_legs'          // Stamina drain immunity
  | 'crowd_favorite';    // Progressive speed boost from crowd energy

export interface BoostCardTemplate {
  id: number;
  name: string;
  description: string;
  rarity: Rarity;
  effectType: BoostEffectType;
  effectMagnitude: number;  // percentage modifier (e.g., 0.15 = 15%)
  durationPct: number;      // portion of race it lasts (0-1)
  iconKey: string;
  color: string;            // card color theme
}

export interface UserBoost {
  id: string;
  userId: string;
  boostCardId: number;
  template: BoostCardTemplate;
  quantity: number;
}

// --- Roster ---
export interface Roster {
  id: string;
  userId: string;
  name: string;
  slots: RosterSlot[];
}

export interface RosterSlot {
  id: string;
  rosterId: string;
  userAthleteId: string;
  athlete: UserAthlete;
  eventType: EventType;
}

// --- Race ---
export type RaceStatus = 'pending' | 'boost_selection' | 'simulating' | 'complete';

export interface Race {
  id: string;
  eventType: EventType;
  status: RaceStatus;
  participants: RaceParticipant[];
  createdAt: string;
  completedAt?: string;
}

export interface RaceParticipant {
  id: string;
  raceId: string;
  userId: string;
  displayName: string;
  userAthleteId: string;
  athlete: UserAthlete;
  lane: number;
  finishTimeMs?: number;
  finishPosition?: number;
  boosts: RaceBoost[];
}

export interface RaceBoost {
  id: string;
  raceId: string;
  userId: string;
  boostCard: BoostCardTemplate;
  targetLane: number;
  appliedAtPct?: number;  // when during race it was applied (0-1)
}

// --- Race Simulation ---
export interface RaceFrame {
  tick: number;
  runners: RunnerFrame[];
}

export interface RunnerFrame {
  lane: number;
  distance: number;       // meters traveled
  speed: number;          // current m/s
  progress: number;       // 0-1 along track path
  activeBoosts: string[]; // names of active boost effects
  finished: boolean;
  finishTimeMs?: number;
}

export interface RaceSimulationInput {
  raceId: string;
  eventType: EventType;
  runners: SimRunnerInput[];
  seed: number;
}

export interface SimRunnerInput {
  lane: number;
  displayName: string;
  stats: AthleteStats;
  bonusStats: AthleteStats;
  boosts: BoostCardTemplate[];
  overallRating: number;
  splitType?: SplitType;
  specialtyEvent?: EventType;
}

export interface RaceSimulationResult {
  frames: RaceFrame[];
  results: RaceResult[];
  totalTicks: number;
  eventType: EventType;
}

export interface RaceResult {
  lane: number;
  displayName: string;
  finishTimeMs: number;
  finishPosition: number;
}

// --- Rewards ---
export interface RaceReward {
  coinsEarned: number;
  xpEarned: number;
  bonusPack?: string;
}

// --- Shop ---
export type PackType = 'bronze' | 'silver' | 'gold' | 'boost' | 'super' | 'gear_basic' | 'gear_pro' | 'gear_elite';

export interface PackContents {
  athletes: AthleteCardTemplate[];
  boosts: BoostCardTemplate[];
  perfBoosts: PerfBoostTemplate[];
}

// --- Socket Events ---
export interface ServerToClientEvents {
  matchFound: (data: { raceId: string; opponent: string }) => void;
  raceStart: (data: { race: Race }) => void;
  raceFrames: (data: { frames: RaceFrame[]; results: RaceResult[] }) => void;
  boostPlayed: (data: { userId: string; boostName: string; lane: number }) => void;
  error: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  findMatch: (data: { eventType: EventType; athleteId: string }) => void;
  cancelMatch: () => void;
  selectBoosts: (data: { raceId: string; boostIds: string[] }) => void;
  playBoost: (data: { raceId: string; boostId: string }) => void;
}
