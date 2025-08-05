import pool from '../db';

export interface Chat {
  id: number;
  user1_id: number;
  user2_id: number;
  is_saved: boolean;
  created_at: Date;
  expires_at: Date | null;
  // если нужен признак бота: is_bot?: boolean;
}

/**
 * Создаёт или возвращает существующий чат между двумя юзерами.
 * @param userId1
 * @param userId2
 */
export async function createOrGetChat(userId1: number, userId2: number): Promise<Chat> {
  // Попробуем найти уже существующий чат
  const { rows } = await pool.query<Chat>(
    `SELECT * 
       FROM chats 
      WHERE (user1_id = $1 AND user2_id = $2)
         OR (user1_id = $2 AND user2_id = $1)
      LIMIT 1`,
    [userId1, userId2],
  );
  if (rows.length) {
    return rows[0];
  }

  // Если не нашли — создаём новый
  // Узнаём, анонимен ли кто-либо из участников
  const [res1, res2] = await Promise.all([
    pool.query<{ is_anonymous: boolean }>(`SELECT is_anonymous FROM users WHERE id=$1`, [userId1]),
    pool.query<{ is_anonymous: boolean }>(`SELECT is_anonymous FROM users WHERE id=$1`, [userId2]),
  ]);
  const u1 = res1.rows[0];
  const u2 = res2.rows[0];
  const ephemeral = u1?.is_anonymous || u2?.is_anonymous;

  const expiresAt = ephemeral
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +1 месяц
    : null;

  const insert = await pool.query<Chat>(
    `INSERT INTO chats (user1_id, user2_id, is_saved, expires_at)
     VALUES ($1, $2, false, $3)
     RETURNING *`,
    [userId1, userId2, expiresAt],
  );
  return insert.rows[0];
}

/**
 * Удаляет чат и все связанные с ним сообщения.
 */
export async function endChat(chatId: number): Promise<void> {
  await pool.query(`DELETE FROM chats WHERE id = $1`, [chatId]);
}

/**
 * Помечает чат как «сохранённый» (is_saved = true).
 */
export async function saveChat(chatId: number): Promise<void> {
  await pool.query(`UPDATE chats SET is_saved = true WHERE id = $1`, [chatId]);
}

/**
 * Получить список чатов пользователя.
 */
export async function getChatsForUser(userId: number): Promise<Chat[]> {
  const { rows } = await pool.query<Chat>(
    `SELECT * 
       FROM chats 
      WHERE user1_id = $1 OR user2_id = $1
      ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
}

export async function getChatUsers(chatId: number): Promise<[number, number]> {
  const { rows } = await pool.query<{ user1_id: number; user2_id: number }>(
    `SELECT user1_id, user2_id FROM chats WHERE id = $1`,
    [chatId],
  );
  if (!rows.length) throw new Error('Chat not found');
  return [rows[0].user1_id, rows[0].user2_id];
}
