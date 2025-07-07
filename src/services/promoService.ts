import * as repo from '../repos/promoRepo';

export async function create(code: string, maxUses: number | null, actorIsAdmin: boolean) {
  if (!actorIsAdmin) throw new Error('FORBIDDEN');
  if (await repo.findByCode(code)) throw new Error('DUPLICATE');
  return repo.create(code, maxUses);
}

export async function use(code: string) {
  const promo = await repo.findByCode(code);
  if (!promo) throw new Error('NOT_FOUND');
  if (promo.expires_at && promo.expires_at < new Date()) throw new Error('EXPIRED');
  if (promo.max_uses !== null && promo.uses >= promo.max_uses) throw new Error('DEPLETED');
  await repo.incUses(promo.id);
}

export async function remove(id: number, actorIsAdmin: boolean) {
  if (!actorIsAdmin) throw new Error('FORBIDDEN');
  if (!(await repo.findById(id))) throw new Error('NOT_FOUND');
  await repo.remove(id);
}

export async function update(
  id: number,
  maxUses: number | null,
  expiresAt: Date | null,
  actorIsAdmin: boolean,
) {
  if (!actorIsAdmin) throw new Error('FORBIDDEN');
  if (!(await repo.findById(id))) throw new Error('NOT_FOUND');
  return repo.update(id, maxUses, expiresAt);
}
