const express = require('express');
const multer = require('multer');
const path = require('path');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const { verifyChatParticipant, createChat, getChat } = require('../models/chat');

const router = express.Router();

// Настройка Multer для загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Папка для сохранения файлов
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

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

// Эндпоинт для отправки сообщения с изображением
router.post('/:chatId/send_message', authMiddleware, upload.single('file'), async (req, res) => {
    const { chatId } = req.params;
    const userId = req.user_id;
    const { content } = req.body;

    try {
        const chat = await verifyChatParticipant(chatId, userId);

        if (!chat) {
            return res.status(403).json({ error: 'Access denied to this chat' });
        }

        let fileUrl = null;
        if (req.file) {
            fileUrl = `/uploads/${req.file.filename}`;
        }

        const savedMessage = await pool.query(
            'INSERT INTO messages (chat_id, sender_id, content, content_type, file_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [chatId, userId, content || '', fileUrl ? 'image' : 'text', fileUrl]
        );

        res.status(201).json(savedMessage.rows[0]);
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        res.status(500).json({ error: 'Ошибка сервера при отправке сообщения' });
    }
});

router.delete('/:chatId/messages/:messageId', authMiddleware, async (req, res) => {
    const { chatId, messageId } = req.params;
    const userId = req.user_id;

    try {
        // Проверяем, что пользователь является участником чата
        const chat = await pool.query(
            'SELECT * FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
            [chatId, userId]
        );

        if (chat.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this chat' });
        }

        // Удаляем сообщение, если оно принадлежит пользователю
        const result = await pool.query(
            'DELETE FROM messages WHERE id = $1 AND sender_id = $2 RETURNING *',
            [messageId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found or access denied' });
        }

        res.status(200).json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Ошибка при удалении сообщения:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.patch('/:chatId/messages/:messageId', authMiddleware, async (req, res) => {
    const { chatId, messageId } = req.params;
    const { content } = req.body;
    const userId = req.user_id;

    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    try {
        // Проверяем, что пользователь является участником чата
        const chat = await pool.query(
            'SELECT * FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
            [chatId, userId]
        );


        if (chat.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied to this chat' });
        }

        // Обновляем сообщение
        const result = await pool.query(
            'UPDATE messages SET content = $1, updated_at = NOW() WHERE id = $2 AND sender_id = $3 RETURNING *',
            [content, messageId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found or access denied' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка при изменении сообщения:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


module.exports = router;