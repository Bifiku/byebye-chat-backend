import pool from '../db';

export interface Message {
  id: number;
  chat_id: number;
  sender_id: number;
  content: string;
  content_type: 'text' | 'bot';
  created_at: Date;
  read_at: Date | null;
}

/**
 * Отправить сообщение в чат.
 */
export async function sendMessage(
  chatId: number,
  senderId: number | null, // null для бота
  content: string,
  contentType: 'text' | 'bot' = 'text',
): Promise<Message> {
  const { rows } = await pool.query<Message>(
    `INSERT INTO messages
       (chat_id, sender_id, content, content_type)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [chatId, senderId, content, contentType],
  );
  return rows[0];
}

/**
 * Получить историю сообщений чата.
 */
export async function getMessages(chatId: number, limit = 50, offset = 0): Promise<Message[]> {
  const { rows } = await pool.query<Message>(
    `SELECT * 
       FROM messages 
      WHERE chat_id = $1
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3`,
    [chatId, limit, offset],
  );
  return rows;
}

/**
 * Отметить сообщение как прочитанное.
 */
export async function markRead(messageId: number): Promise<void> {
  await pool.query(
    `UPDATE messages 
        SET read_at = now() 
      WHERE id = $1`,
    [messageId],
  );
}

/** История с курсором: берем сообщения старше (меньше id) beforeId */
export async function listMessages(
  chatId: number,
  limit = 50,
  beforeId?: number,
): Promise<{ items: Message[]; nextBeforeId?: number }> {
  const params: any[] = [chatId];
  let where = 'chat_id = $1';
  if (beforeId) {
    params.push(beforeId);
    where += ` AND id < $${params.length}`;
  }
  params.push(limit);
  const { rows } = await pool.query<Message>(
    `SELECT *
       FROM messages
      WHERE ${where}
      ORDER BY id DESC
      LIMIT $${params.length}`,
    params,
  );

  // отдавать в хронологическом порядке удобнее фронту
  const items = rows.slice().reverse();
  const nextBeforeId = rows.length ? rows[rows.length - 1].id : undefined;
  return { items, nextBeforeId };
}

/** Прочитал до messageId (монотонно увеличиваем указатель) */
export async function markReadUpTo(
  chatId: number,
  userId: number,
  messageId: number,
): Promise<{ last_read_message_id: number; last_read_at: Date }> {
  // Обновляем, только если messageId больше предыдущего
  const { rows } = await pool.query(
    `INSERT INTO chat_reads (chat_id, user_id, last_read_message_id, last_read_at)
         VALUES ($1, $2, $3, now())
      ON CONFLICT (chat_id, user_id) DO UPDATE
         SET last_read_message_id = GREATEST(
               chat_reads.last_read_message_id,
               EXCLUDED.last_read_message_id
             ),
             last_read_at = now()
      RETURNING last_read_message_id, last_read_at`,
    [chatId, userId, messageId],
  );
  return rows[0];
}

/** Получить текущие курсоры прочтения по чату (для обоих участников) */
export async function getReadCursors(
  chatId: number,
): Promise<{ user_id: number; last_read_message_id: number | null; last_read_at: Date | null }[]> {
  const { rows } = await pool.query(
    `SELECT u.id as user_id,
            cr.last_read_message_id,
            cr.last_read_at
       FROM users u
       JOIN chats c ON (u.id = c.user1_id OR u.id = c.user2_id)
  LEFT JOIN chat_reads cr ON cr.chat_id = c.id AND cr.user_id = u.id
      WHERE c.id = $1`,
    [chatId],
  );
  return rows;
}
