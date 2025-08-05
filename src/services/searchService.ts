// src/services/searchService.ts
import pool from '../db';

import { createOrGetChat, Chat } from './chatService';
import { sendMessage } from './messageService';

export interface SearchFilters {
  gender?: 'male' | 'female' | 'other';
  age_group?: 'under_18' | '18_30' | '31_44' | '45_plus';
  goal: 'talk' | 'flirt' | 'dating' | 'any';
}

/**
 * Добавить пользователя в очередь поиска с заданными фильтрами.
 */
export async function enqueue(userId: number, filters: SearchFilters): Promise<void> {
  await pool.query(
    `INSERT INTO waiting_users (user_id, gender, age_group, goal)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id) DO UPDATE
       SET gender = EXCLUDED.gender,
           age_group = EXCLUDED.age_group,
           goal = EXCLUDED.goal,
           enqueued_at = now()`,
    [userId, filters.gender || null, filters.age_group || null, filters.goal],
  );
}

/**
 * Отменить поиск партнёра.
 */
export async function cancel(userId: number): Promise<void> {
  await pool.query(`DELETE FROM waiting_users WHERE user_id = $1`, [userId]);
}

/**
 * Найти случайного партнёра или вернуть null, если никого нет.
 */
export async function findPartner(userId: number): Promise<{ user_id: number } | null> {
  // простой поиск первого доступного
  const { rows } = await pool.query<{ user_id: number }>(
    `SELECT user_id 
       FROM waiting_users 
      WHERE user_id != $1
      ORDER BY enqueued_at
      LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

/**
 * Основная логика: поиск реального пользователя,
 * иначе чат с ботом.
 */
export async function findRandomChat(userId: number, filters: SearchFilters): Promise<Chat | null> {
  // 1) ставим в очередь
  await enqueue(userId, filters);

  // 2) пробуем найти реального партнёра
  const partner = await findPartner(userId);
  if (!partner) {
    // пока никого нет — возвращаем null
    return null;
  }

  // 3) нашли — удаляем из очереди и создаём чат
  await cancel(userId);
  await cancel(partner.user_id);
  return await createOrGetChat(userId, partner.user_id);
}
