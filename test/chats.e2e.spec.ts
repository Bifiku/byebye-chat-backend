import request from 'supertest';
import { app } from '../src';
let token: string;

beforeAll(async () => {
  const r = await request(app)
    .post('/api/v1/auth/register_anonymous')
    .send({ username: 'chatuser', icon_id: 1 });
  token = r.body.token;
});

describe('Chats Endpoints', () => {
  it('GET /api/v1/chats unauthorized → 401', async () => {
    const res = await request(app).get('/api/v1/chats');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/chats empty list → 200 []', async () => {
    const res = await request(app).get('/api/v1/chats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
