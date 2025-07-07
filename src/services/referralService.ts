import crypto from 'crypto';

import * as repo from '../repos/referralRepo';

export async function generate(authorId: number, maxUses: number | null) {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  return repo.create(authorId, code, maxUses);
}

export async function apply(code: string) {
  const ref = await repo.findByCode(code);
  if (!ref) throw new Error('NOT_FOUND');
  if (!(await repo.tryUse(ref.id))) throw new Error('DEPLETED');
  return ref.user_id; // чей код – тому +1
}
