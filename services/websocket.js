const WebSocket = require('ws');
const pool = require('../db');
const { extractUserIdFromToken } = require('../models/auth');
const { MAX_MESSAGE_LENGTH } = require('../constants');

// Настраиваем хранение подключений
const connections = {};

// Функция для настройки WebSocket
function setupWebSocket(server) {
    const wss = new WebSocket.Server({ server });

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

                            const chatData = {
                                type: 'chat_found',
                                chat_id: chat.rows[0].id,
                                partner_id: partnerId,
                            };

                            // Уведомляем первого пользователя
                            connections[user_id]?.send(JSON.stringify(chatData));

                            // Уведомляем второго пользователя
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
                    // Логика для typing_start / typing_stop
                    const chat = await pool.query(
                        'SELECT * FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
                        [chat_id, user_id]
                    );

                    if (chat.rows.length === 0) {
                        console.log(`Пользователь ${user_id} не является участником чата ${chat_id}`);
                        return;
                    }

                    const otherUserId = chat.rows[0].user1_id === user_id ? chat.rows[0].user2_id : chat.rows[0].user1_id;

                    if (connections[otherUserId]) {
                        connections[otherUserId].send(JSON.stringify({ type, chat_id, user_id }));
                    }
                    return;
                }

                if (content && content.length > MAX_MESSAGE_LENGTH) {
                    ws.send(JSON.stringify({ error: `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters` }));
                    return;
                }
            });

            ws.on('close', async () => {
                if (user_id && connections[user_id] === ws) {
                    delete connections[user_id];
                    console.log(`Пользователь ${user_id} отключился.`);
                    await pool.query('DELETE FROM waiting_users WHERE user_id = $1', [user_id]);
                }
            });
        }
    });

    console.log('WebSocket настроен.');
}

module.exports = setupWebSocket;
