import pool from '../db';

/* найти код по строке */
export const findByCode = (code: string) =>
  pool.query('SELECT * FROM referral_codes WHERE code = $1', [code]).then((r) => r.rows[0] ?? null);

/* создать код */
export const create = (authorId: number, code: string, maxUses: number | null) =>
  pool
    .query(
      `INSERT INTO referral_codes (user_id, code, max_uses)
     VALUES ($1,$2,$3) RETURNING *`,
      [authorId, code, maxUses],
    )
    .then((r) => r.rows[0]);

/* инкремент uses, вернуть true если можно использовать */
export const tryUse = (id: number) =>
  pool
    .query(
      `UPDATE referral_codes
        SET uses = uses + 1
      WHERE id = $1
        AND (max_uses IS NULL OR uses < max_uses)
    RETURNING *`,
      [id],
    )
    .then((r) => !!r.rowCount);
