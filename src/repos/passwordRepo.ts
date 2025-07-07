import pool from '../db';

export async function findByUsernameOrMail(username?: string, email?: string) {
  const { rows } = await pool.query(
    `SELECT * FROM users
       WHERE ($1::text IS NOT NULL AND username = $1)
          OR ($2::text IS NOT NULL AND email    = $2)
       LIMIT 1`,
    [username ?? null, email ?? null],
  );
  return rows[0] ?? null;
}

export async function saveResetCode(userId: number, code: string, ttlMinutes = 10) {
  await pool.query(
    `UPDATE users
        SET reset_code = $1,
            reset_code_expires = NOW() + ($2 || ' minutes')::interval
      WHERE id = $3`,
    [code, ttlMinutes, userId],
  );
}

export async function verifyCode(userId: number, code: string) {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM users
       WHERE id = $1
         AND reset_code = $2
         AND reset_code_expires > NOW()`,
    [userId, code],
  );
  return !!rowCount;
}

export async function updatePassword(userId: number, hash: string) {
  await pool.query(
    `UPDATE users
        SET password = $1,
            reset_code = NULL,
            reset_code_expires = NULL
      WHERE id = $2`,
    [hash, userId],
  );
}
