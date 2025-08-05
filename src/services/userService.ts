// src/services/userService.ts
import bcrypt from 'bcrypt';

import pool from '../db';

export interface UserProfile {
  id: number;
  fullname: string;
  username: string;
  email: string | null;
  is_anonymous: boolean;
  gender: 'male' | 'female' | 'other' | null;
  age_group: 'under_18' | '18_30' | '31_44' | '45_plus' | null;
  referral_code: string;
  inviter_id: number | null;
  referrals_ids: number[];
  language: 'EN' | 'RU';
  created_at: Date;
  updated_at: Date;
}

/**
 * Получить профиль пользователя по ID.
 */
export async function getUserById(userId?: number): Promise<UserProfile> {
  if (!userId) {
    throw new Error('getUserByIdError: userId undefined');
  }
  const { rows } = await pool.query<UserProfile>(
    `SELECT
       id,
       fullname,
       username,
       email,
       is_anonymous,
       gender,
       age_group,
       referral_code,
       inviter_id,
       referrals_ids,
       language,
       created_at,
       updated_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId],
  );
  if (!rows.length) {
    throw new Error('getUserByIdError: User not found');
  }
  return rows[0];
}

/**
 * Обновить поля профиля пользователя.
 * Поддерживает fullname, username, email, password, gender, age_group, language.
 */
export async function updateUser(
  userId: number,
  updates: Partial<{
    fullname: string;
    username: string;
    email: string;
    password: string;
    gender: 'male' | 'female' | 'other';
    age_group: 'under_18' | '18_30' | '31_44' | '45_plus';
    language: 'EN' | 'RU';
  }>,
): Promise<UserProfile> {
  const fields: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (updates.fullname !== undefined) {
    fields.push(`fullname = $${idx++}`);
    vals.push(updates.fullname);
  }
  if (updates.username !== undefined) {
    // проверка уникальности
    const { rows: u } = await pool.query(`SELECT 1 FROM users WHERE username = $1 AND id != $2`, [
      updates.username,
      userId,
    ]);
    if (u.length) throw new Error('Username already taken');
    fields.push(`username = $${idx++}`);
    vals.push(updates.username);
  }
  if (updates.email !== undefined) {
    // проверка уникальности
    const { rows: e } = await pool.query(`SELECT 1 FROM users WHERE email = $1 AND id != $2`, [
      updates.email,
      userId,
    ]);
    if (e.length) throw new Error('Email already taken');
    fields.push(`email = $${idx++}`);
    vals.push(updates.email);
  }
  if (updates.password !== undefined) {
    const hash = await bcrypt.hash(updates.password, 10);
    fields.push(`password_hash = $${idx++}`);
    vals.push(hash);
  }
  if (updates.gender !== undefined) {
    fields.push(`gender = $${idx++}`);
    vals.push(updates.gender);
  }
  if (updates.age_group !== undefined) {
    fields.push(`age_group = $${idx++}`);
    vals.push(updates.age_group);
  }
  if (updates.language !== undefined) {
    fields.push(`language = $${idx++}`);
    vals.push(updates.language);
  }

  if (!fields.length) {
    return getUserById(userId);
  }

  // всегда обновляем updated_at
  fields.push(`updated_at = now()`);

  const sql = `
    UPDATE users
       SET ${fields.join(', ')}
     WHERE id = $${idx}
     RETURNING *
  `;
  vals.push(userId);

  const { rows } = await pool.query<UserProfile>(sql, vals);
  return rows[0];
}
