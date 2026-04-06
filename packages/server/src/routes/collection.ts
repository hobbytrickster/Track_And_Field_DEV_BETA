import { FastifyInstance } from 'fastify';
import { getDb, saveDb } from '../db';
import { authenticate } from './auth';
import { ATHLETE_TEMPLATES, BOOST_TEMPLATES, ECONOMY } from '@track-stars/shared';

export function registerCollectionRoutes(app: FastifyInstance) {
  app.get('/api/collection/athletes', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;

    const db = getDb();
    return db.userAthletes
      .filter(a => a.userId === userId)
      .map(a => ({
        id: a.id,
        userId: a.userId,
        cardId: a.cardId,
        template: ATHLETE_TEMPLATES.find(t => t.id === a.cardId),
        level: a.level,
        xp: a.xp,
        bonusStats: {
          speed: a.speedBonus,
          stamina: a.staminaBonus,
          acceleration: a.accelerationBonus,
          form: a.formBonus,
        },
        appearance: a.appearance || null,
      }));
  });

  app.get('/api/collection/boosts', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;

    const db = getDb();
    return db.userBoosts
      .filter(b => b.userId === userId && b.quantity > 0)
      .map(b => ({
        id: b.id,
        userId: b.userId,
        boostCardId: b.boostCardId,
        template: BOOST_TEMPLATES.find(t => t.id === b.boostCardId),
        quantity: b.quantity,
      }));
  });

  app.post('/api/collection/athletes/:id/levelup', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;

    const { id } = request.params as any;
    const { sacrificeId } = request.body as any;

    const db = getDb();
    const athlete = db.userAthletes.find(a => a.id === id && a.userId === userId);
    const sacrifice = db.userAthletes.find(a => a.id === sacrificeId && a.userId === userId);

    if (!athlete || !sacrifice) return reply.status(404).send({ error: 'Athlete not found' });
    if (athlete.cardId !== sacrifice.cardId) return reply.status(400).send({ error: 'Can only use duplicate cards' });

    const template = ATHLETE_TEMPLATES.find(t => t.id === athlete.cardId);
    const maxLevel = template ? ({ bronze: 5, silver: 10, gold: 15, platinum: 20, diamond: 25 }[template.rarity] || 10) : 10;
    if (athlete.level >= maxLevel) return reply.status(400).send({ error: 'Already at max level' });

    // Random stat bonus
    const r = Math.random();
    if (r < 0.25) athlete.speedBonus++;
    else if (r < 0.5) athlete.staminaBonus++;
    else if (r < 0.75) athlete.accelerationBonus++;
    else athlete.formBonus++;
    athlete.level++;

    // Remove sacrifice
    db.userAthletes = db.userAthletes.filter(a => a.id !== sacrificeId);
    saveDb();

    return {
      id: athlete.id,
      level: athlete.level,
      bonusStats: {
        speed: athlete.speedBonus, stamina: athlete.staminaBonus,
        acceleration: athlete.accelerationBonus, form: athlete.formBonus,
      },
    };
  });

  // Update an athlete's appearance
  app.put('/api/collection/athletes/:id/appearance', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;

    const { id } = request.params as any;
    const appearance = request.body as any;

    const db = getDb();
    const athlete = db.userAthletes.find(a => a.id === id && a.userId === userId);
    if (!athlete) return reply.status(404).send({ error: 'Athlete not found' });

    athlete.appearance = appearance;
    saveDb();
    return { ok: true, appearance };
  });

  // Release (sell) an athlete — earn coins based on rarity
  app.delete('/api/collection/athletes/:id', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;

    const { id } = request.params as any;
    const db = getDb();
    const idx = db.userAthletes.findIndex(a => a.id === id && a.userId === userId);
    if (idx === -1) return reply.status(404).send({ error: 'Athlete not found' });

    const athleteRow = db.userAthletes[idx];
    const template = ATHLETE_TEMPLATES.find(t => t.id === athleteRow.cardId);
    const sellValue = template ? (ECONOMY.sellValues[template.rarity] || 25) : 25;

    db.userAthletes.splice(idx, 1);

    const user = db.users.find(u => u.id === userId);
    if (user) user.coins += sellValue;

    saveDb();
    return { ok: true, coinsEarned: sellValue, newBalance: user?.coins || 0 };
  });

  // Get team count
  app.get('/api/collection/count', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;
    const db = getDb();
    const count = db.userAthletes.filter(a => a.userId === userId).length;
    return { count, max: 50 };
  });
}
