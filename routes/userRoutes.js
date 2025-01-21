// routes/userRoutes.js
const express = require('express');
const { createUser, getUserById } = require('../models/user');
const authMiddleware = require("../middleware/authMiddleware");
const pool = require("../db");
const bcrypt = require("bcrypt");
const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { username } = req.body;
        const user = await createUser(username);
        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка при создании пользователя' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const user = await getUserById(req.params.id);
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ error: 'Пользователь не найден' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Ошибка при получении пользователя' });
    }
});

router.post('/convert_to_permanent', authMiddleware, async (req, res) => {
    const userId = req.user_id;
    const { username, email, password } = req.body;

    try {
        // Проверяем уникальность имени пользователя
        const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Хешируем пароль
        const hashedPassword = await bcrypt.hash(password, 10);

        // Обновляем данные пользователя
        await pool.query(
            'UPDATE users SET username = $1, email = $2, password = $3, is_permanent = true WHERE id = $4',
            [username, email, hashedPassword, userId]
        );

        res.status(200).json({ message: 'User successfully converted to permanent' });
    } catch (error) {
        console.error('Error converting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/delete_account', authMiddleware, async (req, res) => {
    const userId = req.user_id;

    try {
        // Удаляем сообщения пользователя
        await pool.query('DELETE FROM messages WHERE sender_id = $1', [userId]);

        // Удаляем чаты пользователя
        await pool.query('DELETE FROM chats WHERE user1_id = $1 OR user2_id = $1', [userId]);

        // Удаляем пользователя
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);

        res.status(200).json({ message: 'Account and all related data deleted' });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


module.exports = router;
