// authRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { generateToken } = require('../models/auth');

// Регистрация анонимного пользователя
router.post('/register_anonymous', async (req, res) => {
    const { username, icon_id } = req.body;

    if (!username || !icon_id) {
        return res.status(400).json({ error: 'Имя пользователя и иконка обязательны' });
    }

    try {
        // Проверяем, занят ли username
        const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Имя пользователя уже занято' });
        }

        // Создаём анонимного пользователя
        const result = await pool.query(
            'INSERT INTO users (username, icon_id) VALUES ($1, $2) RETURNING id',
            [username, icon_id]
        );

        const user_id = result.rows[0].id;
        const token = generateToken(user_id); // Генерация JWT

        res.status(201).json({ token });
    } catch (error) {
        console.error('Ошибка при создании пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // Проверяем уникальность имени пользователя
        const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Хешируем пароль
        const hashedPassword = await bcrypt.hash(password, 10);

        // Сохраняем пользователя
        const user = await pool.query(
            'INSERT INTO users (username, email, password, is_permanent) VALUES ($1, $2, $3, true) RETURNING *',
            [username, email, hashedPassword]
        );

        const accessToken = jwt.sign({ user_id: user.rows[0].id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        const refreshToken = jwt.sign({ user_id: user.rows[0].id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '365d' });

        res.status(201).json({ accessToken, refreshToken });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.post('/refresh_token', async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token provided' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        const user = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.user_id]);
        if (!user.rows.length) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Проверяем, анонимный ли пользователь
        if (!user.rows[0].is_permanent) {
            // Удаляем анонимного пользователя и все связанные данные
            await pool.query('DELETE FROM messages WHERE sender_id = $1', [decoded.user_id]);
            await pool.query('DELETE FROM chats WHERE user1_id = $1 OR user2_id = $1', [decoded.user_id]);
            await pool.query('DELETE FROM users WHERE id = $1', [decoded.user_id]);

            return res.status(401).json({ error: 'Anonymous account expired and deleted' });
        }

        // Генерация нового access токена
        const newAccessToken = jwt.sign({ user_id: decoded.user_id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.status(200).json({ accessToken: newAccessToken });
    } catch (error) {
        res.status(403).json({ error: 'Invalid or expired refresh token' });
    }
});


module.exports = router;
