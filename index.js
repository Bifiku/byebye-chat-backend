// index.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pool = require('./db');
const { extractUserIdFromToken } = require('./models/auth');
const rateLimit = require('express-rate-limit');

// Создаём ограничитель запросов для API
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 100, // Ограничение 100 запросов за 15 минут
    message: 'Too many requests, please try again later.'
});

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use('/api/', apiLimiter);

app.use(express.json());

const userRoutes = require('./routes/userRoutes');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const {MAX_MESSAGE_LENGTH} = require("./constants");

// API versioning
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/chats', chatRoutes);

// Настраиваем хранение подключений
const connections = {};

// Настраиваем WebSocket-соединения
wss.on('connection', async (ws, req) => {
    const token = req.url.split('?token=')[1];
    const user_id = extractUserIdFromToken(token);

    if (user_id) {
        ws.user_id = user_id;
        connections[user_id] = ws;

        ws.on('message', async (message) => {
            const { type, chat_id, content } = JSON.parse(message);

            if (type === 'find_partner') {
                try {
                    // Проверяем, есть ли пользователь уже в очереди
                    const existingUser = await pool.query(
                        'SELECT * FROM waiting_users WHERE user_id = $1',
                        [user_id]
                    );

                    if (existingUser.rows.length > 0) {
                        ws.send(JSON.stringify({ error: 'Вы уже в очереди!' }));
                        return;
                    }

                    // Ищем собеседника
                    const partner = await pool.query(
                        'SELECT * FROM waiting_users WHERE user_id != $1 ORDER BY created_at ASC LIMIT 1',
                        [user_id]
                    );

                    if (partner.rows.length > 0) {
                        const partnerId = partner.rows[0].user_id;

                        // Создаём чат
                        const chat = await pool.query(
                            'INSERT INTO chats (user1_id, user2_id, is_active) VALUES ($1, $2, true) RETURNING *',
                            [user_id, partnerId]
                        );

                        // Уведомляем обоих участников
                        connections[user_id]?.send(JSON.stringify({
                            type: 'chat_found',
                            chat_id: chat.rows[0].id,
                            partner_id: partnerId,
                        }));

                        connections[partnerId]?.send(JSON.stringify({
                            type: 'chat_found',
                            chat_id: chat.rows[0].id,
                            partner_id: user_id,
                        }));

                        // Удаляем собеседника из очереди
                        await pool.query('DELETE FROM waiting_users WHERE user_id = $1', [partnerId]);
                    } else {
                        // Добавляем пользователя в очередь
                        await pool.query('INSERT INTO waiting_users (user_id) VALUES ($1)', [user_id]);
                        ws.send(JSON.stringify({ message: 'Поиск собеседника...' }));
                    }
                } catch (error) {
                    console.error('Ошибка при поиске собеседника:', error);
                    ws.send(JSON.stringify({ error: 'Ошибка сервера при поиске собеседника' }));
                }
                return;
            }

            if (type === 'typing_start' || type === 'typing_stop') {
                // Определяем второго участника чата
                const chat = await pool.query(
                    'SELECT * FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
                    [chat_id, user_id]
                );

                if (chat.rows.length === 0) {
                    console.log(`Пользователь ${user_id} не является участником чата ${chat_id}`);
                    return;
                }

                const otherUserId = chat.rows[0].user1_id === user_id ? chat.rows[0].user2_id : chat.rows[0].user1_id;

                // Отправляем событие второму участнику
                if (connections[otherUserId]) {
                    connections[otherUserId].send(JSON.stringify({
                        type,
                        chat_id,
                        user_id,
                    }));
                }
                return;
            }

            // Проверка длины сообщения
            if (content && content.length > MAX_MESSAGE_LENGTH) {
                ws.send(JSON.stringify({ error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` }));
                return;
            }

            // Проверка, что отправитель — участник чата
            const chat = await pool.query(
                'SELECT * FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
                [chat_id, user_id]
            );

            if (chat.rows.length === 0) {
                console.log(`Пользователь ${user_id} не является участником чата ${chat_id}`);
                return;
            }

            // Определение второго участника
            const otherUserId = chat.rows[0].user1_id === user_id ? chat.rows[0].user2_id : chat.rows[0].user1_id;

            // Сохраняем сообщение в базе данных
            const savedMessage = await pool.query(
                'INSERT INTO messages (chat_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
                [chat_id, user_id, content]
            );

            // Отправляем сообщение второму участнику, если он онлайн
            if (connections[otherUserId]) {
                connections[otherUserId].send(JSON.stringify(savedMessage.rows[0]));

                // Помечаем как прочитанное сразу и уведомляем отправителя
                await pool.query(
                    'UPDATE messages SET read_at = NOW() WHERE id = $1',
                    [savedMessage.rows[0].id]
                );

                connections[user_id].send(JSON.stringify({
                    messageId: savedMessage.rows[0].id,
                    read_at: new Date().toISOString(),
                }));
            }
        });

        ws.on('close', async () => {
            if (user_id && connections[user_id] === ws) {
                delete connections[user_id];
                console.log(`Пользователь ${user_id} отключился`);

                // Удаляем пользователя из очереди ожидания
                await pool.query('DELETE FROM waiting_users WHERE user_id = $1', [user_id]);
            }
        });
    }
});

// Улучшение обработки ошибок
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (err.code === '23505') { // Конфликт уникального ключа
        return res.status(409).send({ error: 'Duplicate entry detected' });
    }
    res.status(500).send({ error: 'Internal Server Error' });
});

// Запуск сервера
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
