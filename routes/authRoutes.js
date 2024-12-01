// routes/authRoutes.js
const express = require('express');
const { generateToken } = require('../models/auth');
const pool = require('../db');

const router = express.Router();

// Эндпоинт для анонимной регистрации
router.post('/register_anonymous', async (req, res) => {
    const { username, icon_id } = req.body;

    if (!username || !icon_id) {
        return res.status(400).json({ error: 'Имя пользователя и иконка обязательны' });
    }

    try {
        // Создаем анонимного пользователя
        const result = await pool.query(
            'INSERT INTO users (username, icon_id) VALUES ($1, $2) RETURNING id',
            [username, icon_id]
        );

        const user_id = result.rows[0].id;
        const token = generateToken(user_id); // Генерируем JWT с user_id

        res.status(201).json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка при создании анонимного пользователя' });
    }
});

module.exports = router;
