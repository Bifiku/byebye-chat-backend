const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const {verifyChatParticipant, createChat, getChat} = require("../models/chat");

const router = express.Router();

// Эндпоинты
router.get('/', authMiddleware, async (req, res) => {
    const userId = req.user_id;

    try {
        const chats = await pool.query(
            `SELECT 
                c.id AS chat_id,
                c.user1_id,
                c.user2_id,
                m.id AS message_id,
                m.content AS last_message,
                m.sender_id,
                m.read_at,
                m.created_at AS last_message_time
            FROM chats c
            LEFT JOIN LATERAL (
                SELECT * FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1
            ) m ON true
            WHERE c.user1_id = $1 OR c.user2_id = $1
            ORDER BY m.created_at DESC NULLS LAST
            LIMIT 50`,
            [userId]
        );

        res.status(200).json(chats.rows);
    } catch (error) {
        console.error('Ошибка при получении списка чатов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.post('/create_or_get', authMiddleware, async (req, res) => {
    const { recipient_id } = req.body;
    const userId = req.user_id;

    if (!recipient_id) {
        return res.status(400).json({ error: 'Recipient ID is required' });
    }

    if (recipient_id === userId) {
        return res.status(400).json({ error: 'You cannot create a chat with yourself' });
    }

    try {
        let chat = await getChat(userId, recipient_id);
        if (!chat) {
            chat = await createChat(userId, recipient_id);
        }

        res.status(200).json(chat);
    } catch (error) {
        console.error('Ошибка при создании или получении чата:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:chatId/messages', authMiddleware, async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user_id;
    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;

    try {
        const chat = await verifyChatParticipant(chatId, userId);

        if (!chat) {
            return res.status(403).json({ error: 'Access denied to this chat' });
        }

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
