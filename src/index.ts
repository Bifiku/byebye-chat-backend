import http from 'http';

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
import setupWebSocket from './services/websocket';
import { setupSwagger } from './swagger';

// 1) Инициализируем Express и HTTP-сервер
export const app = express();
export const server = http.createServer(app);

// 2) Security & middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests, please try again later.',
  }),
);

// 3) «Здоровье» приложения
app.get('/api/ping', (_req, res) => {
  res.json({ ok: true });
});

// 4) Swagger (документация)
setupSwagger(app); // монтирует /api/docs

// 5) Основные роуты
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/password', passwordRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/chats', chatRoutes);
app.use('/api/v1/promo', promoRoutes);
app.use('/api/v1/referral', referralRoutes);

// 6) WebSocket (handshake по /api/v1/ws)
setupWebSocket(server);

// 7) Глобальный error-handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// 8) Запуск сервера только в не-тестовом режиме
if (process.env.NODE_ENV !== 'test') {
  const PORT = Number(process.env.PORT || 5000);
  server.listen(PORT, '0.0.0.0', () => console.log(`Server listening on ${PORT}`));
}
