// /routes/chatRoutes.js
const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware')

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
    const user_id = req.user_id;

    try {
        const result = await pool.query(
            `SELECT chats.*,
                COUNT(messages.id) AS unread_count,
                (SELECT content 
                 FROM messages 
                 WHERE chat_id = chats.id 
                 ORDER BY created_at DESC 
                 LIMIT 1) AS last_message
             FROM chats
             LEFT JOIN messages ON messages.chat_id = chats.id 
                            AND messages.sender_id != $1 
                            AND messages.is_read = false
             WHERE chats.user1_id = $1 OR chats.user2_id = $1
             GROUP BY chats.id;`,
            [user_id]
        );



        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Ошибка при получении списка чатов:', error);
        res.status(500).json({ error: 'Ошибка при получении списка чатов' });
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
    const user_id = req.user_id;

    // Проверка, что пользователь является участником чата
    const chat = await pool.query(
        'SELECT * FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
        [chatId, user_id]
    );

    if (chat.rows.length === 0) {
        return res.status(403).json({ error: 'У вас нет доступа к этому чату' });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at',
            [chatId]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка при получении сообщений' });
    }
});


module.exports = router;
