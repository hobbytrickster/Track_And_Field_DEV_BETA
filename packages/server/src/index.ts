import Fastify from 'fastify';
import cors from '@fastify/cors';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { registerAuthRoutes } from './routes/auth';
import { registerCollectionRoutes } from './routes/collection';
import { registerShopRoutes } from './routes/shop';
import { registerRaceRoutes } from './routes/race';
import { registerFriendsRoutes } from './routes/friends';
import { registerChallengeRoutes } from './routes/challenge';
import { getDb, saveDb } from './db';
import { openPack } from './services/pack-opener';
import { ATHLETE_TEMPLATES } from '@track-stars/shared';

const PORT = parseInt(process.env.PORT || '3001', 10);

async function main() {
  const app = Fastify({ logger: true });

  // CORS - allow all origins for now (restrict in production with a domain)
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Initialize database
  const db = getDb();
  console.log('Database initialized');

  // Seed default account: Jake / 12345678
  if (!db.users.find(u => u.email === 'Jake')) {
    const id = uuid();
    const passwordHash = bcrypt.hashSync('12345678', 10);
    db.users.push({
      id, email: 'Jake', displayName: 'Jake', passwordHash,
      coins: 500, level: 1, xp: 0, wins: 0, losses: 0,
      createdAt: new Date().toISOString(),
    });
    db.rosters.push({ id: uuid(), userId: id, name: 'Main Roster' });

    // Give Jake one of every athlete card template with random appearances
    const HC = [0x222222, 0x4a3000, 0x8B4513, 0xDAA520, 0xCC3300, 0x888888, 0x111111];
    const JC = [0xff4444, 0x4488ff, 0x44cc44, 0xffaa00, 0xff44ff, 0x00ddaa, 0x2244aa, 0xcc0000];
    const SC = [0x222244, 0x000000, 0x222222, 0x002244, 0x440022, 0x333333];
    const SHC = [0x222222, 0xffffff, 0xff0000, 0x0044ff, 0x00cc00, 0xffaa00];
    for (let ti = 0; ti < ATHLETE_TEMPLATES.length; ti++) {
      const tmpl = ATHLETE_TEMPLATES[ti];
      db.userAthletes.push({
        id: uuid(), userId: id, cardId: tmpl.id,
        level: 1, xp: 0,
        speedBonus: 0, staminaBonus: 0, accelerationBonus: 0, formBonus: 0,
        acquiredAt: new Date().toISOString(),
        appearance: {
          skinTone: ti % 6,
          hairStyle: ti % 6,
          hairColor: HC[ti % HC.length],
          jerseyColor: JC[ti % JC.length],
          shortsColor: SC[ti % SC.length],
          shoeColor: SHC[ti % SHC.length],
          accessory: ti % 5 === 0 ? (ti % 3) + 1 : 0,
        },
      });
    }
    // Also give some boosts
    openPack(id, 'gold');
    openPack(id, 'gold');

    db.users[db.users.length - 1].coins = 5000; // admin coins
    saveDb();
    console.log(`Seeded default account: Jake with ${ATHLETE_TEMPLATES.length} athletes`);
  }

  // Seed additional permanent accounts
  const permanentAccounts = ['Joey', 'Frankie', 'Cat', 'Nick', 'Norm', 'Pat', 'Andy', 'Raph', 'Lauren', 'Kevin', 'Sean', 'Dan', 'Admin'];
  const passwordHash = bcrypt.hashSync('12345678', 10);
  for (const name of permanentAccounts) {
    if (!db.users.find(u => u.email === name)) {
      const uid = uuid();
      db.users.push({
        id: uid, email: name, displayName: name, passwordHash,
        coins: 500, level: 1, xp: 0, wins: 0, losses: 0,
        createdAt: new Date().toISOString(),
      });
      db.rosters.push({ id: uuid(), userId: uid, name: 'Main Roster' });
      // Give each a starter bronze pack
      saveDb();
      openPack(uid, 'bronze');
      console.log(`Seeded account: ${name}`);
    }
  }

  // Register routes
  registerAuthRoutes(app);
  registerCollectionRoutes(app);
  registerShopRoutes(app);
  registerRaceRoutes(app);
  registerFriendsRoutes(app);
  registerChallengeRoutes(app);

  // Health check
  app.get('/api/health', async () => ({ status: 'ok', game: 'Win Big: Track and Field' }));

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`\n🏃 Win Big: Track and Field server running on http://localhost:${PORT}`);
    console.log(`   API: http://localhost:${PORT}/api/health\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
