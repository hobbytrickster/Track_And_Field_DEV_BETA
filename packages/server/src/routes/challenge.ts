import { FastifyInstance } from 'fastify';
import { v4 as uuid } from 'uuid';
import { getDb, saveDb } from '../db';
import { authenticate } from './auth';
import { runChallengeRace } from '../services/race-runner';
import { EventType } from '@track-stars/shared';

const EXPIRY_HOURS = 24;

function checkExpiredChallenges() {
  const db = getDb();
  if (!db.challenges) return;
  const now = new Date();
  for (const ch of db.challenges) {
    if (ch.status === 'pending' && new Date(ch.expiresAt) < now) {
      ch.status = 'expired';
      // Mark all invited entries as declined
      const entries = (db.challengeEntries || []).filter(e => e.challengeId === ch.id);
      for (const e of entries) {
        if (e.status === 'invited') e.status = 'declined';
      }
    }
  }
  saveDb();
}

export function registerChallengeRoutes(app: FastifyInstance) {
  // Create a challenge (creator submits their athlete + boosts inline)
  app.post('/api/challenge/create', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;

    const { friendId, eventType, userAthleteId, boostIds } = request.body as {
      friendId: string;
      eventType: EventType;
      userAthleteId: string;
      boostIds: string[];
    };

    if (!friendId || !eventType || !userAthleteId) {
      return reply.status(400).send({ error: 'friendId, eventType, and userAthleteId are required' });
    }
    if (!['200m', '400m', '800m'].includes(eventType)) {
      return reply.status(400).send({ error: 'Invalid event type' });
    }

    const db = getDb();

    // Verify friendship
    if (!db.friendships) db.friendships = [];
    const [a, b] = [userId, friendId].sort();
    const isFriend = db.friendships.some(f => f.userA === a && f.userB === b);
    if (!isFriend) return reply.status(400).send({ error: 'You can only challenge friends' });

    // Verify athlete ownership
    const athlete = db.userAthletes.find(at => at.id === userAthleteId && at.userId === userId);
    if (!athlete) return reply.status(400).send({ error: 'Athlete not found' });

    // Consume boosts
    const validBoostIds: string[] = [];
    for (const bid of (boostIds || [])) {
      const ub = db.userBoosts.find(b2 => b2.id === bid && b2.userId === userId && b2.quantity > 0);
      if (ub) {
        validBoostIds.push(bid);
        ub.quantity -= 1;
        if (ub.quantity <= 0) db.userBoosts = db.userBoosts.filter(b2 => b2.id !== bid);
      }
    }

    const challengeId = uuid();
    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    db.challenges.push({
      id: challengeId,
      eventType,
      creatorId: userId,
      status: 'pending',
      seed: Date.now(),
      maxPlayers: 2,
      expiresAt,
      simulationResult: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    });

    // Creator entry — lane 4
    db.challengeEntries.push({
      id: uuid(), challengeId, userId,
      userAthleteId, boostIds: validBoostIds,
      lane: 4, status: 'submitted', viewedResult: false,
      createdAt: new Date().toISOString(),
    });

    // Opponent entry — lane 5, invited
    db.challengeEntries.push({
      id: uuid(), challengeId, userId: friendId,
      userAthleteId: '', boostIds: [],
      lane: 5, status: 'invited', viewedResult: false,
      createdAt: new Date().toISOString(),
    });

    saveDb();

    const creator = db.users.find(u => u.id === userId);
    return { challengeId, status: 'pending', creatorName: creator?.displayName };
  });

  // Submit entry for a challenge (opponent accepts)
  app.post('/api/challenge/submit', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;

    const { challengeId, userAthleteId, boostIds } = request.body as {
      challengeId: string;
      userAthleteId: string;
      boostIds: string[];
    };

    const db = getDb();
    const challenge = db.challenges.find(c => c.id === challengeId);
    if (!challenge) return reply.status(404).send({ error: 'Challenge not found' });
    if (challenge.status !== 'pending') return reply.status(400).send({ error: 'Challenge is no longer pending' });

    const entry = db.challengeEntries.find(e => e.challengeId === challengeId && e.userId === userId);
    if (!entry) return reply.status(404).send({ error: 'You are not part of this challenge' });
    if (entry.status !== 'invited') return reply.status(400).send({ error: 'Already submitted or declined' });

    const athlete = db.userAthletes.find(at => at.id === userAthleteId && at.userId === userId);
    if (!athlete) return reply.status(400).send({ error: 'Athlete not found' });

    // Consume boosts
    const validBoostIds: string[] = [];
    for (const bid of (boostIds || [])) {
      const ub = db.userBoosts.find(b2 => b2.id === bid && b2.userId === userId && b2.quantity > 0);
      if (ub) {
        validBoostIds.push(bid);
        ub.quantity -= 1;
        if (ub.quantity <= 0) db.userBoosts = db.userBoosts.filter(b2 => b2.id !== bid);
      }
    }

    entry.userAthleteId = userAthleteId;
    entry.boostIds = validBoostIds;
    entry.status = 'submitted';
    saveDb();

    // All entries submitted — run the race
    const allEntries = db.challengeEntries.filter(e => e.challengeId === challengeId);
    const allSubmitted = allEntries.every(e => e.status === 'submitted' || e.status === 'declined');

    if (allSubmitted) {
      try {
        const result = runChallengeRace(challengeId);
        return { ok: true, status: 'simulated', challengeId };
      } catch (err: any) {
        return reply.status(500).send({ error: 'Race simulation failed: ' + err.message });
      }
    }

    return { ok: true, status: 'pending' };
  });

  // Decline a challenge
  app.post('/api/challenge/decline', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;
    const { challengeId } = request.body as { challengeId: string };

    const db = getDb();
    const entry = db.challengeEntries.find(e => e.challengeId === challengeId && e.userId === userId);
    if (!entry) return reply.status(404).send({ error: 'Not found' });
    if (entry.status !== 'invited') return reply.status(400).send({ error: 'Cannot decline' });

    entry.status = 'declined';
    const challenge = db.challenges.find(c => c.id === challengeId);
    if (challenge) challenge.status = 'expired';
    saveDb();
    return { ok: true };
  });

  // List pending challenges (where I'm invited)
  app.get('/api/challenge/pending', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;

    checkExpiredChallenges();
    const db = getDb();
    const pending = (db.challengeEntries || [])
      .filter(e => e.userId === userId && e.status === 'invited')
      .map(e => {
        const ch = db.challenges.find(c => c.id === e.challengeId);
        if (!ch || ch.status !== 'pending') return null;
        const creator = db.users.find(u => u.id === ch.creatorId);
        return {
          challengeId: ch.id,
          eventType: ch.eventType,
          creatorName: creator?.displayName || 'Unknown',
          creatorId: ch.creatorId,
          createdAt: ch.createdAt,
          expiresAt: ch.expiresAt,
        };
      })
      .filter(Boolean);

    return pending;
  });

  // List all my challenges (active + completed)
  app.get('/api/challenge/list', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;

    checkExpiredChallenges();
    const db = getDb();
    const myEntries = (db.challengeEntries || []).filter(e => e.userId === userId);
    const challengeIds = [...new Set(myEntries.map(e => e.challengeId))];

    return challengeIds.map(cid => {
      const ch = db.challenges.find(c => c.id === cid);
      if (!ch) return null;
      const entries = db.challengeEntries.filter(e => e.challengeId === cid);
      const opponent = entries.find(e => e.userId !== userId);
      const opponentUser = opponent ? db.users.find(u => u.id === opponent.userId) : null;
      const myEntry = entries.find(e => e.userId === userId);

      return {
        challengeId: ch.id,
        eventType: ch.eventType,
        status: ch.status,
        opponentName: opponentUser?.displayName || 'Unknown',
        opponentId: opponent?.userId,
        isCreator: ch.creatorId === userId,
        myEntry: myEntry ? { status: myEntry.status, viewedResult: myEntry.viewedResult } : null,
        createdAt: ch.createdAt,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30);
  });

  // Get challenge result (simulation data for playback)
  app.get('/api/challenge/:id/result', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;
    const { id } = request.params as { id: string };

    const db = getDb();
    const ch = db.challenges.find(c => c.id === id);
    if (!ch) return reply.status(404).send({ error: 'Challenge not found' });
    if (ch.status !== 'simulated') return reply.status(400).send({ error: 'Race not yet simulated' });

    const myEntry = db.challengeEntries.find(e => e.challengeId === id && e.userId === userId);
    if (!myEntry) return reply.status(403).send({ error: 'Not a participant' });

    // Mark as viewed
    myEntry.viewedResult = true;
    saveDb();

    const parsed = ch.simulationResult ? JSON.parse(ch.simulationResult) : null;
    const laneMetadata = parsed?.laneMetadata || {};

    // Build lane labels: for the viewing player, their lane is "YOU", friend lanes get friend names
    const laneLabels: Record<number, string> = {};
    const allEntries = db.challengeEntries.filter(e => e.challengeId === id && e.status === 'submitted');
    for (const e of allEntries) {
      const u = db.users.find(u2 => u2.id === e.userId);
      laneLabels[e.lane] = e.userId === userId ? 'YOU' : (u?.displayName || 'Opponent');
    }

    // Use the challenge creator's stadium for the race
    const creator = db.users.find(u => u.id === ch.creatorId);
    const stadiumConfig = creator?.stadium || null;

    return {
      challengeId: ch.id,
      eventType: ch.eventType,
      playerLane: myEntry.lane,
      simulation: parsed,
      laneLabels,
      laneMetadata,
      stadiumConfig,
    };
  });
}
