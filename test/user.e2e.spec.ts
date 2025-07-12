import request from 'supertest';
import { app } from '../src';
let token: string;

beforeAll(async () => {
  const r = await request(app)
    .post('/api/v1/auth/register_anonymous')
    .send({ username: 'test', icon_id: 1 });
  token = r.body.token;
});

describe('User Endpoints', () => {
  it('GET /api/v1/users without token → 401', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/users with token → 200 + body', async () => {
    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });
});
