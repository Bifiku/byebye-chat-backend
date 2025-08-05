import pool from '../db';

export interface FriendRequest {
  id: number;
  from_user: number;
  to_user: number;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: Date;
  responded_at: Date | null;
}

/**
 * Отправить запрос в друзья.
 */
export async function sendRequest(fromUser: number, toUser: number): Promise<FriendRequest> {
  const { rows } = await pool.query<FriendRequest>(
    `INSERT INTO friend_requests (from_user, to_user)
     VALUES ($1, $2)
     RETURNING *`,
    [fromUser, toUser],
  );
  return rows[0];
}

/**
 * Ответить на запрос: принять или отклонить.
 */
export async function respond(requestId: number, action: 'accept' | 'reject'): Promise<void> {
  const status = action === 'accept' ? 'accepted' : 'rejected';
  await pool.query(
    `UPDATE friend_requests
        SET status = $1,
            responded_at = now()
      WHERE id = $2`,
    [status, requestId],
  );

  if (status === 'accepted') {
    // при необходимости — сразу сохраняем чат
    const { rows } = await pool.query<{ chat_id: number }>(
      `SELECT id as chat_id FROM chats WHERE id = $1`,
      [requestId],
    );
    // если нужно, можно пометить is_saved = true для этого чата
  }
}

/**
 * Получить входящие/исходящие запросы для пользователя.
 */
export async function listRequests(userId: number): Promise<FriendRequest[]> {
  const { rows } = await pool.query<FriendRequest>(
    `SELECT * 
       FROM friend_requests
      WHERE from_user = $1 OR to_user = $1
      ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
}
