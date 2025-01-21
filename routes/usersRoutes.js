const express = require('express');
const router = express.Router();
const pool = require('../db');

// Поиск пользователя по нику
router.get('/search', async (req, res) => {
    const { username } = req.query;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    try {
        const result = await pool.query('SELECT id, username, icon_id FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Ошибка при поиске пользователя:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
