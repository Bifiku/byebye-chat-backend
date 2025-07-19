// test/authAnonymous.e2e.spec.ts
import request from 'supertest';

import { app } from '../src';
import pool from '../src/db';

import { expectTokens, expectValidationErrors } from './utils/authUtils';

export let ACCESS_TOKEN: string = '';

const REGISTER_VARIANTS: [string, Record<string, any>, string[]][] = [
  ['отсутствует body', {}, ['icon_id', 'username', 'email', 'password']],
  ['отсутствует email', { username: 'user', password: 'password', icon_id: 1 }, ['email']],
  [
    'icon_id является строкой',
    { username: 'user', email: 'test@mail.com', password: 'password', icon_id: 'asd12' },
    ['icon_id'],
  ],
];

beforeAll(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
});

describe('POST /api/v1/auth/register_anonymous', () => {
  it('АНОНИМНАЯ РЕГИСТРАЦИЯ: УСПЕШНО! Возвращает accessToken и refreshToken', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register_anonymous')
      .send({ username: 'user123', icon_id: 5 });
    await expectTokens(res, 201);
  });

  it('пустое тело даёт 400 с массивом ошибок validationResult', async () => {
    const res = await request(app).post('/api/v1/auth/register_anonymous').send({});
    expectValidationErrors(res, ['username', 'icon_id']);
  });
});

describe('POST /api/v1/auth/register', () => {
  it('ОБЫЧНАЯ РЕГИСТРАЦИЯ: УСПЕШНО! Возвращает accessToken и refreshToken', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      username: 'test_user',
      email: 'test@mail.com',
      password: 'password123',
      icon_id: 1,
    });
    await expectTokens(res, 201);
    ACCESS_TOKEN = res.body.accessToken;
  });

  test.each(REGISTER_VARIANTS)('%s', async (_title, body, expectPaths) => {
    const res = await request(app).post('/api/v1/auth/register').send(body);
    expectValidationErrors(res, expectPaths);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('АВТОРИЗАЦИЯ: УСПЕШНО! Возвращает accessToken и refreshToken', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      username: 'test_user',
      password: 'password123',
    });
    await expectTokens(res, 200);
  });

  it('АВТОРИЗАЦИЯ: НЕ УСПЕШНО! ПУСТОЕ ТЕЛО', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expectValidationErrors(res, ['username', 'password'], 400);
  });

  it('АВТОРИЗАЦИЯ: НЕ УСПЕШНО! Неверные имя пользователя или пароль', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      username: 'novalid',
      password: 'novalid',
    });
    expectValidationErrors(res, [], 401);
  });
});

afterAll(async () => {
  await pool.end();
});
