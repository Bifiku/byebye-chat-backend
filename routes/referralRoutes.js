const router = require("./authRoutes");
const authMiddleware = require("../middleware/authMiddleware");
const pool = require("../db");

router.post('/create', authMiddleware, async (req, res) => {
    const userId = req.user_id;
    const { max_uses } = req.body;

    try {
        const code = Math.random().toString(36).substr(2, 8).toUpperCase();

        const referral = await pool.query(
            'INSERT INTO referral_codes (user_id, code, max_uses) VALUES ($1, $2, $3) RETURNING *',
            [userId, code, max_uses || null]
        );

        res.status(201).json(referral.rows[0]);
    } catch (error) {
        console.error('Ошибка при создании реферального кода:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;
