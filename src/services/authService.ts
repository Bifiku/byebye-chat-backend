// src/services/authService.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import pool from '../db';
import { generateCode } from '../helpers/generateCode';

const JWT_SECRET = process.env.JWT_SECRET!;
const ACCESS_TOKEN_EXPIRES_IN = '1h';
const WS_TOKEN_EXPIRES_IN = '7d';
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

function signAccessToken(userId: number): string {
  return jwt.sign({ userId, type: 'api' }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

function signWsToken(userId: number): string {
  return jwt.sign({ userId, type: 'ws' }, JWT_SECRET, {
    expiresIn: WS_TOKEN_EXPIRES_IN,
  });
}

function signRefreshToken(userId: number): string {
  return jwt.sign({ userId, type: 'api' }, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

export async function registerAnonymous(): Promise<{
  accessToken: string;
  refreshToken: string;
  wsToken: string;
}> {
  const username = await generateUniqueAnonymousUsername();
  const referralCode = await generateUniqueReferralCode();

  const insertRes = await pool.query<{ id: number }>(
    `INSERT INTO users (username, referral_code)
     VALUES ($1, $2)
     RETURNING id`,
    [username, referralCode],
  );
  const userId = insertRes.rows[0].id;

  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  const wsToken = signWsToken(userId);

  return { accessToken, refreshToken, wsToken };
}

export async function registerFull(params: {
  username: string;
  email: string;
  password: string;
  referral_code?: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  wsToken: string;
}> {
  const { username, email, password, referral_code } = params;
  const passwordHash = await bcrypt.hash(password, 10);
  const referralCode = await generateUniqueReferralCode();

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

  let userId: number;

  try {
    const insertRes = await pool.query<{ id: number }>(
      `INSERT INTO users
         (username, email, password, is_anonymous, referral_code, inviter_id)
       VALUES ($1,$2,$3,false,$4,$5)
       RETURNING id`,
      [username, email, passwordHash, referralCode, inviterId],
    );
    userId = insertRes.rows[0].id;
  } catch (err: any) {
    // Unique violation: 23505
    if (err.code === '23505') {
      // Можно получить имя поля из err.detail
      if (err.detail?.includes('username')) {
        throw { status: 409, message: 'Username уже занят' };
      }
      if (err.detail?.includes('email')) {
        throw { status: 409, message: 'Email уже занят' };
      }
      throw { status: 409, message: 'Пользователь с такими данными уже существует' };
    }
    throw err; // Прочие ошибки пусть обрабатываются выше
  }

  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  const wsToken = signWsToken(userId);

  return { accessToken, refreshToken, wsToken };
}

export async function login(
  identifier: string,
  password: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  wsToken: string;
}> {
  const { rows } = await pool.query<{
    id: number;
    password_hash: string;
  }>(
    `SELECT id, password
       FROM users
      WHERE username = $1 OR email = $1
      LIMIT 1`,
    [identifier],
  );
  if (!rows.length) throw new Error('User not found');
  const { id, password_hash } = rows[0];
  const match = await bcrypt.compare(password, password_hash);
  if (!match) throw new Error('Invalid credentials');

  const accessToken = signAccessToken(id);
  const refreshToken = signRefreshToken(id);
  const wsToken = signWsToken(id);

  return { accessToken, refreshToken, wsToken };
}

export async function refreshTokens(oldRefreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  wsToken: string;
}> {
  let payload: { userId: number; type: string };
  try {
    payload = jwt.verify(oldRefreshToken, JWT_SECRET) as any;
  } catch {
    throw new Error('Invalid refresh token');
  }
  if (payload.type !== 'api') {
    throw new Error('Invalid token type');
  }
  const userId = payload.userId;

  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  const wsToken = signWsToken(userId);

  return { accessToken, refreshToken, wsToken };
}
