// /routes/chatRoutes.js
const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware')

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
    const userId = req.user_id;

    try {
        const chats = await pool.query(
            `
            SELECT 
                c.id AS chat_id,
                c.user1_id,
                c.user2_id,
                m.id AS message_id,
                m.content AS last_message,
                m.sender_id,
                m.read_at,
                m.created_at AS last_message_time
            FROM 
                chats c
            LEFT JOIN 
                LATERAL (
                    SELECT * 
                    FROM messages 
                    WHERE chat_id = c.id 
                    ORDER BY created_at DESC 
                    LIMIT 1
                ) m ON true
            WHERE 
                c.user1_id = $1 OR c.user2_id = $1
            ORDER BY 
                m.created_at DESC NULLS LAST
            LIMIT 50;
            `,
            [userId]
        );

        res.status(200).json(chats.rows);
    } catch (error) {
        console.error('Ошибка при получении списка чатов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});



router.post('/create', async (req, res) => {
    const { user1_id, user2_id } = req.body;

    if (!user1_id || !user2_id) {
        return res.status(400).json({ error: 'Необходимо указать двух пользователей' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO chats (user1_id, user2_id, is_active) VALUES ($1, $2, $3) RETURNING *',
            [user1_id, user2_id, true]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка при создании чата' });
    }
});

router.get('/:chatId/messages', authMiddleware, async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user_id;
    const limit = parseInt(req.query.limit, 10) || 50; // Лимит сообщений (по умолчанию 50)
    const offset = parseInt(req.query.offset, 10) || 0; // Смещение для пагинации

    try {
        // Проверяем, является ли пользователь участником чата
        const chat = await pool.query(
            'SELECT * FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
            [chatId, userId]
        );

        if (chat.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this chat' });
        }

        // Получаем сообщения с лимитом и смещением
        const messages = await pool.query(
            'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
            [chatId, limit, offset]
        );

        res.status(200).json(messages.rows);
    } catch (error) {
        console.error('Ошибка при получении сообщений:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.post('/find_random_chat', authMiddleware, async (req, res) => {
    const userId = req.user_id;

    try {
        // Проверяем очередь ожидания
        const partner = await pool.query(
            'SELECT * FROM waiting_users WHERE user_id != $1 LIMIT 1',
            [userId]
        );

        if (partner.rows.length > 0) {
            const partnerId = partner.rows[0].user_id;

            // Создаём временный чат
            const chat = await pool.query(
                'INSERT INTO chats (user1_id, user2_id, is_active) VALUES ($1, $2, true) RETURNING *',
                [userId, partnerId]
            );

            // Удаляем из очереди
            await pool.query('DELETE FROM waiting_users WHERE user_id = $1', [partnerId]);

            res.status(201).json(chat.rows[0]);
        } else {
            // Добавляем пользователя в очередь
            await pool.query('INSERT INTO waiting_users (user_id) VALUES ($1)', [userId]);
            res.status(200).json({ message: 'Вы добавлены в очередь ожидания' });
        }
    } catch (error) {
        console.error('Ошибка при поиске случайного чата:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


router.post('/cancel_find_partner', authMiddleware, async (req, res) => {
    const userId = req.user_id;

    try {
        // Проверяем, есть ли пользователь в таблице waiting_users
        const userInQueue = await pool.query(
            'SELECT * FROM waiting_users WHERE user_id = $1',
            [userId]
        );

        if (userInQueue.rows.length === 0) {
            return res.status(404).json({ error: 'Пользователь не находится в очереди ожидания.' });
        }

        // Удаляем пользователя из очереди
        await pool.query('DELETE FROM waiting_users WHERE user_id = $1', [userId]);
        res.status(200).json({ message: 'Вы прекратили поиск собеседника.' });
    } catch (error) {
        console.error('Ошибка при отмене поиска:', error);
        res.status(500).json({ error: 'Ошибка сервера при отмене поиска' });
    }
});

router.delete('/:chatId/end', authMiddleware, async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user_id;

    try {
        // Проверяем, что пользователь участник чата
        const chat = await pool.query(
            'SELECT * FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
            [chatId, userId]
        );

        if (chat.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this chat' });
        }

        // Удаляем все связанные сообщения
        await pool.query('DELETE FROM messages WHERE chat_id = $1', [chatId]);

        // Удаляем сам чат
        await pool.query('DELETE FROM chats WHERE id = $1', [chatId]);

        res.status(200).json({ message: 'Чат завершён и удалён' });
    } catch (error) {
        console.error('Ошибка при завершении чата:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.patch('/:chatId/add_to_friends', authMiddleware, async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user_id;

    try {
        // Проверяем, что пользователь участник чата
        const chat = await pool.query(
            'SELECT * FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
            [chatId, userId]
        );

        if (chat.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this chat' });
        }

        // Обновляем статус чата
        const updatedChat = await pool.query(
            'UPDATE chats SET is_saved = true WHERE id = $1 RETURNING *',
            [chatId]
        );

        res.status(200).json(updatedChat.rows[0]);
    } catch (error) {
        console.error('Ошибка при сохранении чата:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


module.exports = router;
