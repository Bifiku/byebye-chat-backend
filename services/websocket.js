const WebSocket = require('ws');
const pool = require('../db');
const { extractUserIdFromToken } = require('../models/auth');
const { MAX_MESSAGE_LENGTH } = require('../constants');
const fs = require("fs");
const path = require("path");

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

        // Подгружаем непрочитанные сообщения
        try {
            const unreadMessages = await pool.query(
                `SELECT m.id, m.chat_id, m.sender_id, m.content, m.content_type, m.file_url, m.created_at
             FROM messages m
             JOIN chats c ON m.chat_id = c.id
             WHERE 
                 (c.user1_id = $1 OR c.user2_id = $1)
                 AND m.sender_id != $1
                 AND m.read_at IS NULL
             ORDER BY m.created_at`,
                [user_id]
            );

            const messageIds = unreadMessages.rows.map(msg => msg.id);

            if (messageIds.length > 0) {
                // Отправляем непрочитанные сообщения клиенту
                unreadMessages.rows.forEach((message) => {
                    ws.send(JSON.stringify({
                        type: 'receive_message',
                        chat_id: message.chat_id,
                        sender_id: message.sender_id,
                        content: message.content,
                        content_type: message.content_type,
                        file_url: message.file_url,
                        created_at: message.created_at,
                        read_at: null,
                    }));
                });

                // Уведомляем отправителей
                for (const message of unreadMessages.rows) {
                    const senderId = message.sender_id;

                    if (connections[senderId]) {
                        connections[senderId].send(JSON.stringify({
                            type: 'messages_read',
                            chat_id: message.chat_id,
                            message_ids: [message.id],
                            read_at: new Date().toISOString(),
                        }));
                    } else {
                        console.log(`Пользователь ${senderId} не в сети, уведомление не отправлено.`);
                    }
                }

                // Обновляем статус сообщений как "прочитанные"
                await pool.query(
                    'UPDATE messages SET read_at = NOW() WHERE id = ANY($1::int[])',
                    [messageIds]
                );

                console.log(`Сообщения ${messageIds.join(', ')} помечены как прочитанные для пользователя ${user_id}.`);
            }
        } catch (error) {
            console.error('Ошибка при подгрузке непрочитанных сообщений:', error);
        }


        ws.on('message', async (message) => {
            const { type, chat_id, content, file  } = JSON.parse(message);

            if (type === 'send_message') {
                try {
                    const chat = await pool.query(
                        'SELECT * FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
                        [chat_id, user_id]
                    );

                    if (chat.rows.length === 0) {
                        ws.send(JSON.stringify({ error: 'Вы не являетесь участником этого чата.' }));
                        return;
                    }

                    const otherUserId = chat.rows[0].user1_id === user_id ? chat.rows[0].user2_id : chat.rows[0].user1_id;

                    let fileUrl = null;
                    if (file && file.data && file.name) {
                        try {
                            const buffer = Buffer.from(file.data, 'base64');
                            const fileName = `${Date.now()}-${file.name}`;
                            const filePath = path.join(__dirname, '../uploads', fileName);

                            fs.writeFileSync(filePath, buffer);
                            fileUrl = `/uploads/${fileName}`;
                        } catch (error) {
                            console.error('Ошибка при сохранении файла:', error);
                            ws.send(JSON.stringify({ error: 'Ошибка при сохранении файла' }));
                            return;
                        }
                    }

                    const contentType = fileUrl ? 'image' : 'text';

                    // Сохраняем сообщение в базе данных
                    const savedMessage = await pool.query(
                        'INSERT INTO messages (chat_id, sender_id, content, content_type, file_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                        [chat_id, user_id, content || '', contentType, fileUrl]
                    );

                    const messageId = savedMessage.rows[0].id; // Извлекаем ID сообщения
                    let readAt = null;

                    // Если получатель в сети, обновляем read_at
                    if (connections[otherUserId]) {
                        readAt = new Date().toISOString();

                        await pool.query(
                            'UPDATE messages SET read_at = $1 WHERE id = $2',
                            [readAt, messageId]
                        );

                        connections[otherUserId].send(JSON.stringify({
                            type: 'receive_message',
                            message_id: messageId,
                            chat_id,
                            sender_id: user_id,
                            content,
                            content_type: contentType,
                            file_url: fileUrl,
                            created_at: savedMessage.rows[0].created_at,
                            read_at: readAt,
                        }));
                    }

                    // Подтверждаем отправителю
                    ws.send(JSON.stringify({
                        type: 'message_sent',
                        message_id: messageId,
                        chat_id,
                        content,
                        content_type: contentType,
                        file_url: fileUrl,
                        created_at: savedMessage.rows[0].created_at,
                        read_at: readAt,
                    }));
                } catch (error) {
                    console.error('Ошибка при отправке сообщения:', error);
                    ws.send(JSON.stringify({ error: 'Ошибка сервера при отправке сообщения' }));
                }
            }


            if (type === 'edit_message') {
                try {
                    const { message_id, content } = JSON.parse(message);

                    // Извлекаем информацию о сообщении и чате
                    const messageData = await pool.query(
                        'SELECT m.chat_id, m.sender_id, c.user1_id, c.user2_id FROM messages m JOIN chats c ON m.chat_id = c.id WHERE m.id = $1',
                        [message_id]
                    );

                    if (messageData.rows.length === 0) {
                        ws.send(JSON.stringify({ error: 'Message not found or access denied' }));
                        return;
                    }

                    const messageInfo = messageData.rows[0];

                    // Проверяем, что пользователь является отправителем сообщения
                    if (messageInfo.sender_id !== user_id) {
                        ws.send(JSON.stringify({ error: 'You can only edit your own messages' }));
                        return;
                    }

                    // Обновляем сообщение
                    const result = await pool.query(
                        'UPDATE messages SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
                        [content, message_id]
                    );

                    const updatedMessage = result.rows[0];

                    // Уведомляем второго участника чата
                    const otherUserId = messageInfo.user1_id === user_id ? messageInfo.user2_id : messageInfo.user1_id;

                    if (connections[otherUserId]) {
                        connections[otherUserId].send(JSON.stringify({
                            type: 'message_edited',
                            message_id: updatedMessage.id,
                            chat_id: updatedMessage.chat_id,
                            content: updatedMessage.content,
                            updated_at: updatedMessage.updated_at,
                        }));
                    }

                    // Подтверждение отправителю
                    ws.send(JSON.stringify({
                        type: 'message_edit_success',
                        message_id: updatedMessage.id,
                        chat_id: updatedMessage.chat_id,
                        content: updatedMessage.content,
                        updated_at: updatedMessage.updated_at,
                    }));
                } catch (error) {
                    console.error('Ошибка при редактировании сообщения:', error);
                    ws.send(JSON.stringify({ error: 'Ошибка сервера при редактировании сообщения' }));
                }
            }

            if (type === 'read_message') {
                try {
                    const { chat_id, message_ids } = JSON.parse(message);

                    if (!chat_id || !Array.isArray(message_ids) || message_ids.length === 0) {
                        console.error('Неверный формат данных для read_message:', { chat_id, message_ids });
                        ws.send(JSON.stringify({ error: 'Неверный формат данных' }));
                        return;
                    }

                    // Проверяем, что пользователь является участником чата
                    const chat = await pool.query('SELECT * FROM chats WHERE id = $1', [chat_id]);

                    if (chat.rows.length === 0) {
                        console.error(`Чат с ID ${chat_id} не найден.`);
                        ws.send(JSON.stringify({ error: 'Чат не найден' }));
                        return;
                    }

                    const isUserParticipant = chat.rows[0].user1_id === user_id || chat.rows[0].user2_id === user_id;
                    if (!isUserParticipant) {
                        console.error(`Пользователь ${user_id} не является участником чата ${chat_id}.`);
                        ws.send(JSON.stringify({ error: 'Вы не участник этого чата' }));
                        return;
                    }

                    // Проверяем, что пользователь не является отправителем сообщений
                    const messages = await pool.query(
                        'SELECT * FROM messages WHERE id = ANY($1::int[]) AND chat_id = $2',
                        [message_ids, chat_id]
                    );

                    const invalidMessages = messages.rows.filter(msg => msg.sender_id === user_id);
                    if (invalidMessages.length > 0) {
                        console.error(`Пользователь ${user_id} пытается пометить свои сообщения как прочитанные.`);
                        ws.send(JSON.stringify({ error: 'Нельзя пометить свои сообщения как прочитанные' }));
                        return;
                    }

                    // Обновляем поле read_at для сообщений
                    await pool.query(
                        'UPDATE messages SET read_at = NOW() WHERE id = ANY($1::int[]) AND chat_id = $2',
                        [message_ids, chat_id]
                    );

                    console.log(`Сообщения ${message_ids} помечены как прочитанные в чате ${chat_id} пользователем ${user_id}.`);

                    // Уведомляем второго участника
                    const otherUserId = chat.rows[0].user1_id === user_id ? chat.rows[0].user2_id : chat.rows[0].user1_id;

                    if (connections[otherUserId]) {
                        connections[otherUserId].send(JSON.stringify({
                            type: 'messages_read',
                            chat_id,
                            message_ids,
                            read_at: new Date().toISOString(),
                        }));
                    }
                } catch (error) {
                    console.error('Ошибка при обработке read_message:', error);
                    ws.send(JSON.stringify({ error: 'Ошибка сервера при обработке read_message' }));
                }
            }




            if (type === 'typing_start' || type === 'typing_stop') {
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
