import pool from '../db';

export const findByCode = (code: string) =>
  pool.query('SELECT * FROM promocodes WHERE code = $1', [code]).then((r) => r.rows[0] ?? null);

export const findById = (id: number) =>
  pool.query('SELECT * FROM promocodes WHERE id = $1', [id]).then((r) => r.rows[0] ?? null);

export const create = (code: string, maxUses: number | null) =>
  pool
    .query('INSERT INTO promocodes (code, max_uses) VALUES ($1,$2) RETURNING *', [code, maxUses])
    .then((r) => r.rows[0]);

export const incUses = (id: number) =>
  pool.query('UPDATE promocodes SET uses = uses + 1 WHERE id = $1', [id]);

export const remove = (id: number) => pool.query('DELETE FROM promocodes WHERE id = $1', [id]);

export const update = (id: number, maxUses: number | null, expiresAt: Date | null) =>
  pool
    .query('UPDATE promocodes SET max_uses = $1, expires_at = $2 WHERE id = $3 RETURNING *', [
      maxUses,
      expiresAt,
      id,
    ])
    .then((r) => r.rows[0]);
