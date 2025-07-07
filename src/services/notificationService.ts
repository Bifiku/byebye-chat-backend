import { messaging } from 'firebase-admin';
import { getMessaging } from 'firebase-admin/messaging';

import pool from '../db';

import BatchResponse = messaging.BatchResponse;

/** Отправить push-уведомление всем устройствам пользователя */
export const sendNotification = async (
  userId: number,
  title: string,
  body: string,
): Promise<void> => {
  /* 1. достаём device-tokens из БД */
  const { rows } = await pool.query<{ token: string }>(
    'SELECT token FROM device_tokens WHERE user_id = $1',
    [userId],
  );
  const tokens = rows.map((r) => r.token);

  if (tokens.length === 0) {
    console.log(`У пользователя ${userId} нет активных токенов.`);
    return;
  }

  /* 2. формируем Multicast-сообщение */
  const message = {
    notification: { title, body },
    tokens,
  };

  /* 3. отправляем через Firebase Cloud Messaging */
  let response: BatchResponse;
  try {
    const messaging = getMessaging();
    response = await messaging.sendEachForMulticast(message);
    console.log(
      `Push отправлен → success ${response.successCount}, error ${response.failureCount}`,
    );
  } catch (err) {
    console.error('FCM error:', err);
    return;
  }

  /* 4. чистим невалидные токены */
  await cleanInvalidTokens(response, tokens);
};

/* удаляем токены, которым FCM вернул ошибку */
const cleanInvalidTokens = async (response: BatchResponse, tokens: string[]): Promise<void> => {
  const invalid = response.responses
    .map((r, i) => (!r.success ? tokens[i] : null))
    .filter((t): t is string => t !== null);

  if (invalid.length === 0) return;

  await pool.query('DELETE FROM device_tokens WHERE token = ANY($1::text[])', [invalid]);
  console.log(`Удалены невалидные токены: ${invalid.length}`);
};
