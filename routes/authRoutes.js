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

module.exports = router;
