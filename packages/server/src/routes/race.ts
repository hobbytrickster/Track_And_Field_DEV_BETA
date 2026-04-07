import { FastifyInstance } from 'fastify';
import { getDb } from '../db';
import { authenticate } from './auth';
import { EventType } from '@track-stars/shared';
import { runRace } from '../services/race-runner';

export function registerRaceRoutes(app: FastifyInstance) {
  app.post('/api/race/start', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;

    const { eventType, userAthleteId, boostIds } = request.body as {
      eventType: EventType;
      userAthleteId: string;
      boostIds: string[];
    };

    if (!eventType || !userAthleteId) {
      return reply.status(400).send({ error: 'eventType and userAthleteId are required' });
    }

    if (!['200m', '400m', '800m'].includes(eventType)) {
      return reply.status(400).send({ error: 'Invalid event type' });
    }

    try {
      const result = runRace({ userId, eventType, userAthleteId, boostIds: boostIds || [] });
      const db = getDb();
      const user = db.users.find(u => u.id === userId);

      return {
        raceId: result.raceId,
        simulation: result.simulation,
        rewards: result.rewards,
        playerLane: result.playerLane,
        user: user ? {
          coins: user.coins, xp: user.xp, level: user.level,
          wins: user.wins, losses: user.losses,
        } : {},
      };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // World records — top 3 times per event across all players
  app.get('/api/race/records', async (request, reply) => {
    const db = getDb();
    const records = db.records || [];
    return {
      '200m': records.filter(r => r.eventType === '200m').sort((a, b) => a.finishTimeMs - b.finishTimeMs).slice(0, 3),
      '400m': records.filter(r => r.eventType === '400m').sort((a, b) => a.finishTimeMs - b.finishTimeMs).slice(0, 3),
      '800m': records.filter(r => r.eventType === '800m').sort((a, b) => a.finishTimeMs - b.finishTimeMs).slice(0, 3),
    };
  });

  // Best times for an event — your top 10 + friends' top 10
  app.get('/api/race/best-times/:eventType', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;
    const { eventType } = request.params as { eventType: string };

    const db = getDb();
    const records = db.records || [];

    // Your best 10 times in this event
    const myBest = records
      .filter(r => r.eventType === eventType && r.userId === userId)
      .sort((a, b) => a.finishTimeMs - b.finishTimeMs)
      .slice(0, 10)
      .map(r => ({ time: r.finishTimeMs, name: r.displayName, date: r.setAt }));

    // Friends' + your best 10 times combined
    const friendships = db.friendships || [];
    const friendIds = friendships
      .filter(f => f.userA === userId || f.userB === userId)
      .map(f => f.userA === userId ? f.userB : f.userA);
    const allIds = [userId, ...friendIds];

    const friendsBest = records
      .filter(r => r.eventType === eventType && allIds.includes(r.userId))
      .sort((a, b) => a.finishTimeMs - b.finishTimeMs)
      .slice(0, 10)
      .map(r => ({ time: r.finishTimeMs, name: r.displayName, isYou: r.userId === userId, date: r.setAt }));

    return { myBest, friendsBest };
  });

  app.get('/api/race/history', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;

    const db = getDb();
    const myParticipations = db.raceParticipants.filter(p => p.userId === userId);

    return myParticipations
      .map(p => {
        const race = db.races.find(r => r.id === p.raceId);
        return {
          raceId: p.raceId,
          eventType: race?.eventType || '',
          finishPosition: p.finishPosition,
          finishTimeMs: p.finishTimeMs,
          lane: p.lane,
          createdAt: race?.createdAt || '',
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);
  });
}
