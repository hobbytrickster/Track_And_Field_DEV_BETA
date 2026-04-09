import { FastifyInstance } from 'fastify';
import { getDb, saveDb } from '../db';
import { authenticate } from './auth';
import { PACK_COSTS, PACK_CONTENTS, PackType } from '@track-stars/shared';
import { openPack } from '../services/pack-opener';

export function registerShopRoutes(app: FastifyInstance) {
  app.post('/api/shop/buy-pack', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;

    const { packType } = request.body as { packType: PackType };
    if (!packType || !PACK_COSTS[packType]) {
      return reply.status(400).send({ error: 'Invalid pack type' });
    }

    const db = getDb();
    const user = db.users.find(u => u.id === userId);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    const cost = PACK_COSTS[packType];
    if (user.coins < cost) {
      return reply.status(400).send({ error: 'Not enough coins', required: cost, current: user.coins });
    }

    // Check team cap (50 max)
    const currentCount = db.userAthletes.filter(a => a.userId === userId).length;
    const packAthletes = PACK_CONTENTS[packType as PackType]?.athletes || 0;
    if (packAthletes > 0 && currentCount + packAthletes > 50) {
      return reply.status(400).send({ error: `Team is full! You have ${currentCount}/50 athletes. Release some first.` });
    }

    user.coins -= cost;
    saveDb();

    const contents = openPack(userId, packType);

    return { packType, cost, remainingCoins: user.coins, contents };
  });

  app.get('/api/shop', async () => {
    return {
      packs: [
        { type: 'bronze', cost: PACK_COSTS.bronze, athletes: 3, boosts: 2, description: 'A basic pack with mostly bronze athletes.' },
        { type: 'silver', cost: PACK_COSTS.silver, athletes: 3, boosts: 3, description: 'Better odds for silver and gold athletes.' },
        { type: 'gold', cost: PACK_COSTS.gold, athletes: 5, boosts: 5, description: 'Premium pack with guaranteed gold or better!' },
      ],
    };
  });
}
