import pool from '../db';

export const listForUser = (userId: number, limit = 50) =>
  pool
    .query(
      `SELECT c.id AS chat_id, c.user1_id, c.user2_id,
          m.id AS message_id, m.content AS last_message,
          m.sender_id, m.read_at, m.created_at AS last_message_time
     FROM chats c
LEFT JOIN LATERAL (
   SELECT * FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1
) m ON true
    WHERE c.user1_id = $1 OR c.user2_id = $1
 ORDER BY m.created_at DESC NULLS LAST
 LIMIT $2`,
      [userId, limit],
    )
    .then((r) => r.rows);

export const get = (u1: number, u2: number) =>
  pool
    .query(
      'SELECT * FROM chats WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)',
      [u1, u2],
    )
    .then((r) => r.rows[0] ?? null);

export const create = (u1: number, u2: number) =>
  pool
    .query('INSERT INTO chats (user1_id, user2_id) VALUES ($1,$2) RETURNING *', [u1, u2])
    .then((r) => r.rows[0]);

export const verifyParticipant = (chatId: number, userId: number) =>
  pool
    .query('SELECT 1 FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)', [
      chatId,
      userId,
    ])
    .then((r) => !!r.rowCount);

export const listMessages = (chatId: number, limit: number, offset: number) =>
  pool
    .query(
      'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [chatId, limit, offset],
    )
    .then((r) => r.rows);

export const saveMessage = (
  chatId: number,
  senderId: number,
  content: string,
  type: 'text' | 'image',
  fileUrl: string | null,
) =>
  pool
    .query(
      'INSERT INTO messages (chat_id,sender_id,content,content_type,file_url) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [chatId, senderId, content, type, fileUrl],
    )
    .then((r) => r.rows[0]);

export const deleteMessage = (msgId: number, senderId: number) =>
  pool
    .query('DELETE FROM messages WHERE id=$1 AND sender_id=$2 RETURNING *', [msgId, senderId])
    .then((r) => r.rows[0]);

export const updateMessage = (msgId: number, senderId: number, content: string) =>
  pool
    .query(
      'UPDATE messages SET content=$1, updated_at=NOW() WHERE id=$2 AND sender_id=$3 RETURNING *',
      [content, msgId, senderId],
    )
    .then((r) => r.rows[0]);

export const participants = (chatId: number) =>
  pool
    .query('SELECT user1_id, user2_id FROM chats WHERE id = $1', [chatId])
    .then((r) => (r.rowCount ? [r.rows[0].user1_id, r.rows[0].user2_id] : []));

/* Пометить сообщения как прочитанные одним UPDATE */
export const markRead = (chatId: number, ids: number[], readerId: number) =>
  pool.query(
    `UPDATE messages
        SET read_at = NOW()
      WHERE chat_id = $1
        AND id   = ANY($2::int[])
        AND sender_id <> $3`,
    [chatId, ids, readerId],
  );
