import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { getDb, saveDb } from '../db';
import { openPack } from '../services/pack-opener';

const JWT_SECRET = process.env.JWT_SECRET || 'track-stars-secret-key-change-in-production';

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

export function authenticate(request: any, reply: any): string | null {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Not authenticated' });
    return null;
  }
  const payload = verifyToken(auth.slice(7));
  if (!payload) {
    reply.status(401).send({ error: 'Invalid token' });
    return null;
  }
  return payload.userId;
}

function userToResponse(u: any) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    coins: u.coins,
    level: u.level,
    xp: u.xp,
    wins: u.wins,
    losses: u.losses,
    createdAt: u.createdAt,
    appearance: u.appearance || null,
    stadium: u.stadium || null,
  };
}

export function registerAuthRoutes(app: FastifyInstance) {
  app.post('/api/auth/register', async (request, reply) => {
    const { username, password, displayName } = request.body as any;
    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password are required' });
    }

    const db = getDb();
    if (db.users.find(u => u.email === username)) {
      return reply.status(409).send({ error: 'Username already taken' });
    }

    const id = uuid();
    const passwordHash = await bcrypt.hash(password, 10);

    db.users.push({
      id, email: username, displayName: displayName || username, passwordHash,
      coins: 500, level: 1, xp: 0, wins: 0, losses: 0,
      createdAt: new Date().toISOString(),
    });

    db.rosters.push({ id: uuid(), userId: id, name: 'Main Roster' });
    saveDb();

    // Starter pack
    openPack(id, 'bronze');

    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '7d' });
    const user = db.users.find(u => u.id === id)!;
    return { token, user: userToResponse(user) };
  });

  app.post('/api/auth/login', async (request, reply) => {
    const { username, password } = request.body as any;
    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password are required' });
    }

    const db = getDb();
    const user = db.users.find(u => u.email === username);
    if (!user) return reply.status(401).send({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    return { token, user: userToResponse(user) };
  });

  app.get('/api/auth/me', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;

    const db = getDb();
    const user = db.users.find(u => u.id === userId);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    return userToResponse(user);
  });

  // Update appearance
  app.put('/api/auth/appearance', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;

    const appearance = request.body as any;
    const db = getDb();
    const user = db.users.find(u => u.id === userId);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    user.appearance = appearance;
    saveDb();
    return { ok: true, appearance };
  });

  // Update stadium
  app.put('/api/auth/stadium', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;
    const stadium = request.body as any;
    const db = getDb();
    const user = db.users.find(u => u.id === userId);
    if (!user) return reply.status(404).send({ error: 'User not found' });
    user.stadium = stadium;
    saveDb();
    return { ok: true, stadium };
  });

  // Update display name
  app.put('/api/auth/profile', async (request, reply) => {
    const userId = authenticate(request, reply);
    if (!userId) return;

    const { displayName } = request.body as any;
    const db = getDb();
    const user = db.users.find(u => u.id === userId);
    if (!user) return reply.status(404).send({ error: 'User not found' });

    if (displayName) user.displayName = displayName;
    saveDb();
    return userToResponse(user);
  });
}
