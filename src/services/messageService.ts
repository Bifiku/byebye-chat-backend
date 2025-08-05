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
