// src/services/authService.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
// eslint-disable-next-line import/no-unresolved
import { v4 as uuidv4 } from 'uuid';

import pool from '../db';
import { generateCode } from '../helpers/generateCode';

const JWT_SECRET = process.env.JWT_SECRET!;
const ACCESS_TOKEN_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN = '30d';

/**
 * Сгенерировать уникальный referral_code (7 символов A–Z0–9).
 */
async function generateUniqueReferralCode(): Promise<string> {
  let code: string;
  let exists: boolean;
  do {
    code = generateCode(7);
    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(1) as count FROM users WHERE referral_code = $1`,
      [code],
    );
    exists = parseInt(rows[0].count, 10) > 0;
  } while (exists);
  return code;
}

/**
 * Генерирует случайную цифровую строку длины length.
 */
function generateNumericSuffix(length: number): string {
  const digits = '0123456789';
  let res = '';
  for (let i = 0; i < length; i++) {
    res += digits[Math.floor(Math.random() * digits.length)];
  }
  return res;
}

/**
 * Генерирует уникальный username вида "anonym_12345",
 * проверяя, что такого ещё нет в базе.
 */
async function generateUniqueAnonymousUsername(): Promise<string> {
  let username: string;
  let exists: boolean;
  do {
    username = `anonym_${generateNumericSuffix(5)}`;
    const { rows } = await pool.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM users WHERE username = $1) AS exists',
      [username],
    );
    exists = rows[0].exists;
  } while (exists);
  return username;
}

/**
 * Регистрирует анонимного пользователя.
 * Возвращает два токена: accessToken и refreshToken.
 */
export async function registerAnonymous(): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const username = await generateUniqueAnonymousUsername();
  const referralCode = await generateUniqueReferralCode();

  // Создаём пользователя, прочие поля (is_anonymous = true и т.п.) по умолчанию в БД
  const insertRes = await pool.query<{ id: number }>(
    `INSERT INTO users (username, referral_code)
     VALUES ($1, $2)
     RETURNING id`,
    [username, referralCode],
  );
  const userId = insertRes.rows[0].id;

  // Генерируем JWT
  const payload = { userId };
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
  const refreshToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });

  return { accessToken, refreshToken };
}

/**
 * Полная регистрация / конвертация анонима.
 */
export async function registerFull(params: {
  username: string;
  email: string;
  password: string;
  referral_code?: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const { username, email, password, referral_code } = params;
  const _password = await bcrypt.hash(password, 10);

  // inviter
  let inviterId: number | null = null;
  if (referral_code) {
    const r = await pool.query<{ id: number }>(
      `SELECT id FROM users WHERE referral_code = $1 LIMIT 1`,
      [referral_code],
    );
    inviterId = r.rows[0]?.id ?? null;
    if (inviterId) {
      await pool.query(
        `UPDATE users
         SET referrals_ids = referrals_ids || $1::jsonb
         WHERE id = $2`,
        [JSON.stringify([inviterId]), inviterId],
      );
    }
  }

  // новый уникальный referral_code для создаваемого юзера
  const newReferralCode = await generateUniqueReferralCode();

  const inserted = await pool.query<{ id: number }>(
    `INSERT INTO users
     (username, email, password, is_anonymous, referral_code, inviter_id)
     VALUES ($1,$2,$3,false,$4,$5)
         RETURNING id`,
    [username, email, _password, newReferralCode, inviterId],
  );
  const userId = inserted.rows[0].id;

  const payload = { userId };
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
  const refreshToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
  return { accessToken, refreshToken };
}

/**
 * Логин по username/email и паролю.
 */
export async function login(
  identifier: string,
  password: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  // identifier может быть username или email
  const { rows } = await pool.query<{
    id: number;
    password: string;
  }>(
    `SELECT id, password
       FROM users
      WHERE username = $1 OR email = $1
      LIMIT 1`,
    [identifier],
  );
  if (!rows.length) {
    throw new Error('User not found');
  }
  const { id, password: password_hash } = rows[0];
  const match = await bcrypt.compare(password, password_hash);
  if (!match) {
    throw new Error('Invalid credentials');
  }

  const payload = { userId: id };
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
  const refreshToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
  return { accessToken, refreshToken };
}

/**
 * Обновление accessToken по refreshToken.
 */
export async function refreshTokens(oldRefreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  try {
    const payload = jwt.verify(oldRefreshToken, JWT_SECRET) as { userId: number };
    const accessToken = jwt.sign({ userId: payload.userId }, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });
    const refreshToken = jwt.sign({ userId: payload.userId }, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });
    return { accessToken, refreshToken };
  } catch (err) {
    throw new Error('Invalid refresh token');
  }
}
