import pool from '../db';

/* ---- read ---- */

export const findById = (id: number) =>
  pool.query('SELECT * FROM users WHERE id = $1', [id]).then((r) => r.rows[0] ?? null);

export const findByUsername = (username: string) =>
  pool.query('SELECT * FROM users WHERE username = $1', [username]).then((r) => r.rows[0] ?? null);

/* ---- create ---- */

export const createAnonymous = (username: string, iconId: number) =>
  pool
    .query('INSERT INTO users (username, icon_id) VALUES ($1,$2) RETURNING id', [username, iconId])
    .then((r) => r.rows[0].id as number);

export const createPermanent = (
  username: string,
  email: string,
  hash: string,
  iconId: number,
  invitedBy: number | null,
) =>
  pool
    .query(
      `INSERT INTO users (username,email,password,icon_id,invited_by,is_permanent)
     VALUES ($1,$2,$3,$4,$5,true) RETURNING id`,
      [username, email, hash, iconId, invitedBy],
    )
    .then((r) => r.rows[0].id as number);

/* ---- update ---- */

export const convertToPermanent = (id: number, username: string, email: string, hash: string) =>
  pool.query(
    `UPDATE users
        SET username=$1,email=$2,password=$3,is_permanent=true
      WHERE id=$4`,
    [username, email, hash, id],
  );

export const saveDeviceToken = (userId: number, token: string) =>
  pool.query(
    `INSERT INTO device_tokens (user_id, token)
         VALUES ($1,$2)
      ON CONFLICT (token) DO NOTHING`,
    [userId, token],
  );

/* ---- stats / lists ---- */

export const inviteStats = (userId: number) =>
  pool.query('SELECT id, username FROM users WHERE invited_by = $1', [userId]).then((r) => r.rows);

export const listPromos = () =>
  pool.query('SELECT * FROM promocodes ORDER BY created_at DESC').then((r) => r.rows);

/* ---- delete ---- */

export async function deleteAnonymous(userId: number) {
  await pool.query('DELETE FROM messages WHERE sender_id = $1', [userId]);
  await pool.query('DELETE FROM chats WHERE user1_id = $1 OR user2_id = $1', [userId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}
