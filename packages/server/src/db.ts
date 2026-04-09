import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DATA_PATH || path.join(__dirname, '..', 'data.json');

export interface DbSchema {
  users: DbUser[];
  userAthletes: DbUserAthlete[];
  userBoosts: DbUserBoost[];
  userPerfBoosts: DbUserPerfBoost[];
  rosters: DbRoster[];
  rosterSlots: DbRosterSlot[];
  races: DbRace[];
  raceParticipants: DbRaceParticipant[];
  records: DbRecord[];
  friendCodes: DbFriendCode[];
  friendships: DbFriendship[];
  challenges: DbChallenge[];
  challengeEntries: DbChallengeEntry[];
}

export interface DbFriendCode {
  userId: string;
  code: string; // 12 chars, displayed as XXXXXX-XXXXXX
}

export interface DbFriendship {
  id: string;
  userA: string; // lexicographically smaller
  userB: string;
  createdAt: string;
}

export interface DbChallenge {
  id: string;
  eventType: string;
  creatorId: string;
  status: 'pending' | 'ready' | 'simulated' | 'expired';
  seed: number;
  maxPlayers: number;
  expiresAt: string;
  simulationResult: string | null; // JSON-stringified RaceSimulationResult
  createdAt: string;
  completedAt: string | null;
}

export interface DbChallengeEntry {
  id: string;
  challengeId: string;
  userId: string;
  userAthleteId: string;
  boostIds: string[];
  lane: number;
  status: 'invited' | 'submitted' | 'declined';
  viewedResult: boolean;
  createdAt: string;
}

export interface DbRecord {
  eventType: string;
  finishTimeMs: number;
  displayName: string;
  userId: string;
  raceId: string;
  setAt: string;
}

export interface DbAppearance {
  skinTone: number;     // index 0-5
  hairStyle: number;    // index 0-5
  hairColor: number;    // hex color
  jerseyColor: number;  // hex color
  shortsColor: number;  // hex color
  shoeColor: number;    // hex color
  accessory: number;    // 0=none, 1=headband, 2=sunglasses, 3=wristbands
}

export interface DbStadium {
  upperDeckColor: number;   // hex
  seatColor: number;        // hex
  infieldLogo: number;      // 0=none, 1=shield, 2=star, 3=diamond, 4=rings, 5=flame
  logoColor: number;        // hex
  trackColor: number;       // hex (track surface)
  fieldColor: number;       // hex (fallback infield color)
  fieldStyle: string;       // turf image key: green, red, blue, purple, pink, orange, white, black, grey, rainbow
  stadiumName: string;
}

export interface DbUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  coins: number;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  createdAt: string;
  appearance?: DbAppearance;
  stadium?: DbStadium;
  lastRaceDate?: string; // YYYY-MM-DD for daily bonus tracking
}

export interface DbUserAthlete {
  id: string;
  userId: string;
  cardId: number;
  level: number;
  xp: number;
  speedBonus: number;
  staminaBonus: number;
  accelerationBonus: number;
  formBonus: number;
  acquiredAt: string;
  appearance?: DbAppearance;
  // Per-card overrides (randomized at pack open time)
  overrideStats?: { speed: number; stamina: number; acceleration: number; form: number };
  overrideOverall?: number;
  overrideSplitType?: string;
  overrideName?: string;
  overrideNationality?: string;
  raceStats?: {
    totalRaces: number;
    wins: number;
    podiums: number;
    lastPlaces: number;
    bestTimes: Record<string, number>;
  };
  appliedPerfBoosts?: number[]; // array of PerfBoostTemplate IDs (max 3)
}

export interface DbUserPerfBoost {
  id: string;
  userId: string;
  perfBoostId: number; // PerfBoostTemplate ID
  quantity: number;
}

export interface DbUserBoost {
  id: string;
  userId: string;
  boostCardId: number;
  quantity: number;
}

export interface DbRoster {
  id: string;
  userId: string;
  name: string;
}

export interface DbRosterSlot {
  id: string;
  rosterId: string;
  userAthleteId: string;
  eventType: string;
}

export interface DbRace {
  id: string;
  eventType: string;
  status: string;
  createdAt: string;
  completedAt?: string;
}

export interface DbRaceParticipant {
  id: string;
  raceId: string;
  userId: string;
  displayName: string;
  userAthleteId?: string;
  lane: number;
  finishTimeMs?: number;
  finishPosition?: number;
}

function defaultDb(): DbSchema {
  return {
    users: [],
    userAthletes: [],
    userBoosts: [],
    userPerfBoosts: [],
    rosters: [],
    rosterSlots: [],
    races: [],
    raceParticipants: [],
    records: [],
    friendCodes: [],
    friendships: [],
    challenges: [],
    challengeEntries: [],
  };
}

let dbCache: DbSchema | null = null;

export function getDb(): DbSchema {
  if (dbCache) return dbCache;
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      dbCache = JSON.parse(raw);
      return dbCache!;
    }
  } catch {}
  dbCache = defaultDb();
  saveDb();
  return dbCache;
}

export function saveDb() {
  if (!dbCache) return;
  fs.writeFileSync(DB_PATH, JSON.stringify(dbCache, null, 2));
}
