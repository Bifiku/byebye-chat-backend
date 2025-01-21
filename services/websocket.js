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
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            ws.close(4001, 'Authorization token is missing or invalid');
            return;
        }

        const token = authHeader.split(' ')[1];
        const user_id = extractUserIdFromToken(token);

        if (!user_id) {
            ws.close(4002, 'Invalid token');
            return;
        }

        ws.user_id = user_id;
        connections[user_id] = ws;

        console.log(`Пользователь ${user_id} подключился.`);

        ws.on('message', async (message) => {
            const { type, chat_id, content } = JSON.parse(message);

            if (type === 'create_chat_message') {
                try {
                    // Проверяем, что пользователь участник чата
                    const chat = await pool.query(
                        'SELECT * FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
                        [chat_id, user_id]
                    );

                    if (chat.rows.length === 0) {
                        ws.send(JSON.stringify({ error: 'You are not a participant of this chat' }));
                        return;
                    }

                    const otherUserId = chat.rows[0].user1_id === user_id ? chat.rows[0].user2_id : chat.rows[0].user1_id;

                    // Сохраняем сообщение в базе данных
                    const savedMessage = await pool.query(
                        'INSERT INTO messages (chat_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
                        [chat_id, user_id, content]
                    );

                    // Отправляем сообщение получателю
                    if (connections[otherUserId]) {
                        connections[otherUserId].send(JSON.stringify({
                            type: 'receive_message',
                            chat_id,
                            sender_id: user_id,
                            content,
                            created_at: savedMessage.rows[0].created_at,
                        }));
                    }

                    // Подтверждаем отправителю
                    ws.send(JSON.stringify({
                        type: 'message_sent',
                        chat_id,
                        recipient_id: otherUserId,
                        content,
                        created_at: savedMessage.rows[0].created_at,
                    }));
                } catch (error) {
                    console.error('Ошибка при отправке сообщения:', error);
                    ws.send(JSON.stringify({ error: 'Ошибка сервера при отправке сообщения' }));
                }
            }

            if (type === 'send_message') {
                try {
                    // Проверяем, существует ли чат
                    const chat = await pool.query(
                        'SELECT * FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
                        [chat_id, user_id]
                    );

                    if (chat.rows.length === 0) {
                        ws.send(JSON.stringify({ error: 'Вы не являетесь участником этого чата.' }));
                        return;
                    }

                    const otherUserId = chat.rows[0].user1_id === user_id ? chat.rows[0].user2_id : chat.rows[0].user1_id;

                    // Сохраняем сообщение в базе данных
                    const savedMessage = await pool.query(
                        'INSERT INTO messages (chat_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *',
                        [chat_id, user_id, content]
                    );

                    // Отправляем сообщение получателю, если он онлайн
                    if (connections[otherUserId]) {
                        connections[otherUserId].send(JSON.stringify({
                            type: 'receive_message',
                            chat_id,
                            sender_id: user_id,
                            content,
                            created_at: savedMessage.rows[0].created_at,
                        }));
                    }

                    // Подтверждаем отправителю, что сообщение доставлено
                    ws.send(JSON.stringify({
                        type: 'message_sent',
                        chat_id,
                        recipient_id: otherUserId,
                        content,
                        created_at: savedMessage.rows[0].created_at,
                    }));
                } catch (error) {
                    console.error('Ошибка при отправке сообщения:', error);
                    ws.send(JSON.stringify({ error: 'Ошибка сервера при отправке сообщения' }));
                }
                return;
            }

            if (type === 'typing_start' || type === 'typing_stop') {
                // Логика для уведомления о наборе текста
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
            }
        });

        ws.on('close', async () => {
            if (user_id && connections[user_id] === ws) {
                delete connections[user_id];
                console.log(`Пользователь ${user_id} отключился.`);
            }
        });
    });

    console.log('WebSocket настроен.');
}

module.exports = setupWebSocket;
