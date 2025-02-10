const router = require("./authRoutes");
const authMiddleware = require("../middleware/authMiddleware");
const pool = require("../db");

router.post('/create', authMiddleware, async (req, res) => {
    const { code, max_uses } = req.body;
    const userId = req.user_id;

    try {
        // Проверяем, является ли пользователь админом
        const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);

        if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }

        // Создаём промокод
        const promo = await pool.query(
            'INSERT INTO promocodes (code, max_uses) VALUES ($1, $2) RETURNING *',
            [code, max_uses || null]
        );

        res.status(201).json(promo.rows[0]);
    } catch (error) {
        console.error('Ошибка при создании промокода:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.post('/use', authMiddleware, async (req, res) => {
    const { code } = req.body;
    const userId = req.user_id;

    try {
        // 1️⃣ Проверяем, существует ли такой промокод
        const promo = await pool.query(
            'SELECT * FROM promocodes WHERE code = $1 AND (max_uses IS NULL OR uses < max_uses)',
            [code]
        );

        if (promo.rows.length === 0) {
            return res.status(400).json({ error: 'Недействительный или исчерпанный промокод' });
        }

        const promoId = promo.rows[0].id;

        // 2️⃣ Проверяем, использовал ли пользователь этот промокод ранее
        const used = await pool.query(
            'SELECT * FROM used_promocodes WHERE user_id = $1 AND promo_id = $2',
            [userId, promoId]
        );

        if (used.rows.length > 0) {
            return res.status(400).json({ error: 'Вы уже использовали этот промокод' });
        }

        // 3️⃣ Помечаем промокод как использованный
        await pool.query(
            'INSERT INTO used_promocodes (user_id, promo_id) VALUES ($1, $2)',
            [userId, promoId]
        );

        // 4️⃣ Увеличиваем счетчик использований промокода
        await pool.query(
            'UPDATE promocodes SET uses = uses + 1 WHERE id = $1',
            [promoId]
        );

        res.status(200).json({ message: 'Промокод успешно использован' });
    } catch (error) {
        console.error('Ошибка при использовании промокода:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;