import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { server } from '../src';

let httpServer: typeof server;
let address: { port: number };

beforeAll((done) => {
  process.env.NODE_ENV = 'test';
  httpServer = server.listen(0, () => {
    // localhost и порт, который сгенерировал Node
    // @ts-ignore
    address = httpServer.address() as { port: number };
    done();
  });
});

afterAll((done) => {
  httpServer.close(done);
});

describe('WebSocket', () => {
  it('handshake and pong', (done) => {
    const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET!, { expiresIn: '1h' });
    const ws = new WebSocket(`ws://localhost:${address.port}/api/v1/ws?token=${token}`);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'ping' }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      expect(msg).toHaveProperty('type', 'pong');
      ws.close();
      done();
    });

    ws.on('error', done);
  });
});
