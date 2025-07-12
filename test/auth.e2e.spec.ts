// test/authAnonymous.e2e.spec.ts
// @ts-ignore
import request from 'supertest';
import { app } from '../src';
import pool from '../src/db';

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
  // очищаем users, чтобы получить predictable userId=1 и т.д.
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
});

describe('POST /api/v1/auth/register_anonymous', () => {
  it('АНОНИМНАЯ РЕГИСТРАЦИЯ: УСПЕШНО! Возвращает accessToken и refreshToken', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register_anonymous')
      .send({ username: 'user123', icon_id: 5 });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');

    // Проверим, что это валидные JWT (xxx.yyy.zzz)
    expect(res.body.accessToken.split('.').length).toBe(3);
    expect(res.body.refreshToken.split('.').length).toBe(3);
  });

  it('пустое тело даёт 400 с массивом ошибок validationResult', async () => {
    const res = await request(app).post('/api/v1/auth/register_anonymous').send({}); // никакого username/icon_id

    expect(res.status).toBe(400);
    // У вас сейчас приходит { errors: Array<ValidationError> }
    expect(Array.isArray(res.body.errors)).toBe(true);
    // Должны быть две ошибки — по username и icon_id
    const paths = res.body.errors.map((e: any) => e.path).sort();
    expect(paths).toEqual(['icon_id', 'username'].sort());
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

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');

    // Проверим, что это валидные JWT (xxx.yyy.zzz)
    expect(res.body.accessToken.split('.').length).toBe(3);
    expect(res.body.refreshToken.split('.').length).toBe(3);
  });

  test.each(REGISTER_VARIANTS)('%s', async (_title, body, expectPaths) => {
    const res = await request(app).post('/api/v1/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
    const paths = res.body.errors.map((e: any) => e.path).sort();
    expect(paths).toEqual(expectPaths.sort());
  });
});

afterAll(async () => {
  await pool.end();
});
