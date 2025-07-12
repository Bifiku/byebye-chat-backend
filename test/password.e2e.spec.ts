import request from 'supertest';
import { app } from '../src';

describe('Password Endpoints', () => {
  it('POST /api/v1/password/forgot-password missing → 400', async () => {
    const res = await request(app).post('/api/v1/password/forgot-password').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/password/forgot-password not found → 404', async () => {
    const res = await request(app)
      .post('/api/v1/password/forgot-password')
      .send({ email: 'nope@mail.com' });
    expect(res.status).toBe(404);
  });

  // Здесь можно замокать письмо и проверить verify/reset код.
});
