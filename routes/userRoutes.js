// routes/userRoutes.js
const express = require('express');
const { createUser, getUserById } = require('../models/user');
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

module.exports = router;
