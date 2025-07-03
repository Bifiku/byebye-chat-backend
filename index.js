const express = require('express');
const http = require('http');
const rateLimit = require('express-rate-limit');
const setupWebSocket = require('./services/websocket');
const userRoutes = require('./routes/userRoutes');
const usersRoutes = require('./routes/usersRoutes');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const passwordRoutes = require('./routes/passwordRoutes');
const promoRoutes = require('./routes/promoRoutes');
const referralRoutes = require('./routes/referralRoutes');
const path = require("path");

require('dotenv').config();

const helmet = require('helmet');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(helmet());
app.use(cors({ origin: '*', methods: 'GET,POST,PUT,DELETE' }));

// Лимиты запросов
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100, // Максимум 100 запросов за 15 минут
    message: 'Too many requests, please try again later.',
});

// Применение лимитов ко всем маршрутам API
app.use('/api/', apiLimiter);

// Настройка API
app.use(express.json());


app.use('/api/v1/user', userRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/chats', chatRoutes);
app.use('/api/v1/password', passwordRoutes);
app.use('/api/v1/promocode', promoRoutes);
app.use('/api/v1/referral', referralRoutes);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/ping', (_req, res) => {
    res.json({ ok: true });
});


// Настройка WebSocket
setupWebSocket(server);

// Запуск сервера
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
