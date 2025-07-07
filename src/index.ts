import http from 'http';
import path from 'path';

import cors from 'cors';
import express, { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import 'dotenv/config';
import authRoutes from './routes/authRoutes';
import chatRoutes from './routes/chatRoutes';
import passwordRoutes from './routes/passwordRoutes';
import promoRoutes from './routes/promoRoutes';
import referralRoutes from './routes/referralRoutes';
import userRoutes from './routes/userRoutes';
import usersRoutes from './routes/usersRoutes';
import setupWebSocket from './services/websocket';

const app = express();
const server = http.createServer(app);

app.use(helmet());
app.use(cors({ origin: '*', methods: 'GET,POST,PUT,DELETE' }));
app.use(express.json());

app.use(
  '/api/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests, please try again later.',
  }),
);

app.use('/api/v1/user', userRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/chats', chatRoutes);
app.use('/api/v1/password', passwordRoutes);
app.use('/api/v1/promocode', promoRoutes);
app.use('/api/v1/referral', referralRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/ping', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

setupWebSocket(server);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
