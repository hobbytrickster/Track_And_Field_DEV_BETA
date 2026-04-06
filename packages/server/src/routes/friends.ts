import { FastifyInstance } from 'fastify';
import { v4 as uuid } from 'uuid';
import { getDb, saveDb } from '../db';
import { authenticate } from './auth';

function generateFriendCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function formatCode(code: string): string {
  return code.slice(0, 6) + '-' + code.slice(6);
}

function normalizeCode(input: string): string {
  return input.replace(/[-\s]/g, '').toUpperCase();
}

function getFriendCode(userId: string): string {
  const db = getDb();
  if (!db.friendCodes) db.friendCodes = [];
  let fc = db.friendCodes.find(f => f.userId === userId);
  if (!fc) {
    let code: string;
    do { code = generateFriendCode(); } while (db.friendCodes.some(f => f.code === code));
    fc = { userId, code };
    db.friendCodes.push(fc);
    saveDb();
  }
  return fc.code;
}

export function registerFriendsRoutes(app: FastifyInstance) {
  // Get my friend code
  app.get('/api/friends/code', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;
    const code = getFriendCode(userId);
    return { code: formatCode(code), raw: code };
  });

  // Add friend by code
  app.post('/api/friends/add', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;
    const { code } = request.body as { code: string };
    if (!code) return reply.status(400).send({ error: 'Friend code is required' });

    const normalized = normalizeCode(code);
    if (normalized.length !== 12) return reply.status(400).send({ error: 'Invalid friend code format' });

    const db = getDb();
    if (!db.friendCodes) db.friendCodes = [];
    if (!db.friendships) db.friendships = [];

    const fc = db.friendCodes.find(f => f.code === normalized);
    if (!fc) return reply.status(404).send({ error: 'Friend code not found' });
    if (fc.userId === userId) return reply.status(400).send({ error: "That's your own code!" });

    // Check if already friends
    const [a, b] = [userId, fc.userId].sort();
    const existing = db.friendships.find(f => f.userA === a && f.userB === b);
    if (existing) return reply.status(409).send({ error: 'Already friends!' });

    db.friendships.push({
      id: uuid(), userA: a, userB: b, createdAt: new Date().toISOString(),
    });
    saveDb();

    const friend = db.users.find(u => u.id === fc.userId);
    return { ok: true, friend: friend ? { id: friend.id, displayName: friend.displayName } : null };
  });

  // Remove friend
  app.delete('/api/friends/:friendId', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;
    const { friendId } = request.params as { friendId: string };

    const db = getDb();
    if (!db.friendships) db.friendships = [];
    const [a, b] = [userId, friendId].sort();
    const idx = db.friendships.findIndex(f => f.userA === a && f.userB === b);
    if (idx === -1) return reply.status(404).send({ error: 'Friendship not found' });

    db.friendships.splice(idx, 1);
    saveDb();
    return { ok: true };
  });

  // List friends with head-to-head records
  app.get('/api/friends', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;

    const db = getDb();
    if (!db.friendships) db.friendships = [];
    if (!db.challenges) db.challenges = [];
    if (!db.challengeEntries) db.challengeEntries = [];

    const friendIds = db.friendships
      .filter(f => f.userA === userId || f.userB === userId)
      .map(f => f.userA === userId ? f.userB : f.userA);

    return friendIds.map(fid => {
      const user = db.users.find(u => u.id === fid);
      if (!user) return null;

      // Head-to-head record from challenges
      const sharedChallenges = db.challenges.filter(c => c.status === 'simulated');
      let wins = 0, losses = 0, draws = 0;

      for (const ch of sharedChallenges) {
        const myEntry = db.challengeEntries.find(e => e.challengeId === ch.id && e.userId === userId && e.status === 'submitted');
        const theirEntry = db.challengeEntries.find(e => e.challengeId === ch.id && e.userId === fid && e.status === 'submitted');
        if (!myEntry || !theirEntry || !ch.simulationResult) continue;

        try {
          const result = JSON.parse(ch.simulationResult);
          const myResult = result.results.find((r: any) => r.lane === myEntry.lane);
          const theirResult = result.results.find((r: any) => r.lane === theirEntry.lane);
          if (myResult && theirResult) {
            if (myResult.finishPosition < theirResult.finishPosition) wins++;
            else if (myResult.finishPosition > theirResult.finishPosition) losses++;
            else draws++;
          }
        } catch {}
      }

      return {
        id: user.id,
        displayName: user.displayName,
        level: user.level,
        wins: user.wins,
        losses: user.losses,
        h2h: { wins, losses, draws },
        friendCode: formatCode(getFriendCode(fid)),
      };
    }).filter(Boolean);
  });

  // Get challenge history with a specific friend
  app.get('/api/friends/:friendId/history', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;
    const { friendId } = request.params as { friendId: string };

    const db = getDb();
    if (!db.challenges) return [];
    if (!db.challengeEntries) return [];

    const history = db.challenges
      .filter(c => c.status === 'simulated')
      .filter(c => {
        const entries = db.challengeEntries.filter(e => e.challengeId === c.id && e.status === 'submitted');
        const myEntry = entries.find(e => e.userId === userId);
        const theirEntry = entries.find(e => e.userId === friendId);
        return myEntry && theirEntry;
      })
      .map(c => {
        const entries = db.challengeEntries.filter(e => e.challengeId === c.id && e.status === 'submitted');
        const myEntry = entries.find(e => e.userId === userId)!;
        const theirEntry = entries.find(e => e.userId === friendId)!;
        let myTime = 0, theirTime = 0, myPos = 0, theirPos = 0;
        try {
          const result = JSON.parse(c.simulationResult!);
          const mr = result.results.find((r: any) => r.lane === myEntry.lane);
          const tr = result.results.find((r: any) => r.lane === theirEntry.lane);
          if (mr) { myTime = mr.finishTimeMs; myPos = mr.finishPosition; }
          if (tr) { theirTime = tr.finishTimeMs; theirPos = tr.finishPosition; }
        } catch {}
        return {
          challengeId: c.id,
          eventType: c.eventType,
          myTime, myPos, theirTime, theirPos,
          createdAt: c.createdAt,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);

    return history;
  });
}
