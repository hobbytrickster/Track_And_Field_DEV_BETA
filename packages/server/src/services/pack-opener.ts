import { v4 as uuid } from 'uuid';
import { getDb, saveDb } from '../db';
import {
  PackType,
  PackContents,
  AthleteCardTemplate,
  BoostCardTemplate,
  Rarity,
  PACK_CONTENTS,
  PACK_DROP_RATES,
  BOOST_DROP_RATES,
  ATHLETE_TEMPLATES,
  BOOST_TEMPLATES,
} from '@track-stars/shared';

function pickRarity(rates: Record<Rarity, number>): Rarity {
  const roll = Math.random();
  let cumulative = 0;
  for (const [rarity, rate] of Object.entries(rates)) {
    cumulative += rate;
    if (roll < cumulative) return rarity as Rarity;
  }
  return 'bronze';
}

function pickTemplate<T extends { rarity: Rarity }>(templates: T[], rarity: Rarity): T {
  const matching = templates.filter(t => t.rarity === rarity);
  if (matching.length === 0) {
    return templates[Math.floor(Math.random() * templates.length)];
  }
  return matching[Math.floor(Math.random() * matching.length)];
}

export function openPack(userId: string, packType: PackType): PackContents {
  const db = getDb();
  const contents = PACK_CONTENTS[packType];
  const athleteRates = PACK_DROP_RATES[packType];
  const boostRates = BOOST_DROP_RATES[packType];

  const athletes: AthleteCardTemplate[] = [];
  const boosts: BoostCardTemplate[] = [];

  for (let i = 0; i < contents.athletes; i++) {
    const rarity = pickRarity(athleteRates);
    const template = pickTemplate(ATHLETE_TEMPLATES, rarity);
    athletes.push(template);

    // Generate a random appearance for each packed athlete
    const HAIR_COLORS = [0x222222, 0x4a3000, 0x8B4513, 0xDAA520, 0xCC3300, 0x888888, 0x111111];
    const JERSEY_COLORS_POOL = [0xff4444, 0x4488ff, 0x44cc44, 0xffaa00, 0xff44ff, 0x00ddaa, 0x2244aa, 0xcc0000, 0x008888];
    const SHORTS_POOL = [0x222244, 0x000000, 0x222222, 0x002244, 0x440022, 0x333333];
    const SHOE_POOL = [0x222222, 0xffffff, 0xff0000, 0x0044ff, 0x00cc00, 0xffaa00, 0x000000];
    const randAppearance = {
      skinTone: Math.floor(Math.random() * 6),
      hairStyle: Math.floor(Math.random() * 6),
      hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
      jerseyColor: JERSEY_COLORS_POOL[Math.floor(Math.random() * JERSEY_COLORS_POOL.length)],
      shortsColor: SHORTS_POOL[Math.floor(Math.random() * SHORTS_POOL.length)],
      shoeColor: SHOE_POOL[Math.floor(Math.random() * SHOE_POOL.length)],
      accessory: Math.random() < 0.2 ? Math.floor(Math.random() * 3) + 1 : 0,
    };

    db.userAthletes.push({
      id: uuid(), userId, cardId: template.id,
      level: 1, xp: 0,
      speedBonus: 0, staminaBonus: 0, accelerationBonus: 0, formBonus: 0,
      acquiredAt: new Date().toISOString(),
      appearance: randAppearance,
    });
  }

  for (let i = 0; i < contents.boosts; i++) {
    const rarity = pickRarity(boostRates);
    const template = pickTemplate(BOOST_TEMPLATES, rarity);
    boosts.push(template);

    const existing = db.userBoosts.find(b => b.userId === userId && b.boostCardId === template.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      db.userBoosts.push({ id: uuid(), userId, boostCardId: template.id, quantity: 1 });
    }
  }

  saveDb();
  return { athletes, boosts };
}
