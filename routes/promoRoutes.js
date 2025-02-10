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

        // Проверяем, существует ли уже промокод
        const existingPromo = await pool.query('SELECT * FROM promocodes WHERE code = $1', [code]);

        if (existingPromo.rows.length > 0) {
            return res.status(400).json({ error: 'Промокод с таким названием уже существует' });
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
        const promo = await pool.query('SELECT * FROM promocodes WHERE code = $1', [code]);

        if (promo.rows.length === 0) {
            return res.status(400).json({ error: 'Промокод не найден' });
        }

        const promoData = promo.rows[0];

        // Проверяем срок действия промокода
        if (promoData.expires_at && new Date(promoData.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Промокод истёк' });
        }

        // Проверяем, не превышено ли число использований
        if (promoData.max_uses !== null && promoData.uses >= promoData.max_uses) {
            return res.status(400).json({ error: 'Промокод исчерпан' });
        }

        // Увеличиваем число использований
        await pool.query('UPDATE promocodes SET uses = uses + 1 WHERE id = $1', [promoData.id]);

        res.status(200).json({ message: 'Промокод успешно использован' });
    } catch (error) {
        console.error('Ошибка при использовании промокода:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


router.delete('/delete/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const userId = req.user_id;

    try {
        // Проверяем, является ли пользователь админом
        const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);

        if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }

        // Проверяем, существует ли промокод
        const promoCheck = await pool.query('SELECT * FROM promocodes WHERE id = $1', [id]);

        if (promoCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Промокод не найден' });
        }

        // Удаляем промокод
        await pool.query('DELETE FROM promocodes WHERE id = $1', [id]);

        res.status(200).json({ message: 'Промокод успешно удалён' });
    } catch (error) {
        console.error('Ошибка при удалении промокода:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

router.patch('/update/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { max_uses, expires_at } = req.body;
    const userId = req.user_id;

    try {
        // Проверяем, является ли пользователь админом
        const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);

        if (adminCheck.rows.length === 0 || !adminCheck.rows[0].is_admin) {
            return res.status(403).json({ error: 'Недостаточно прав' });
        }

        // Проверяем, существует ли промокод
        const promoCheck = await pool.query('SELECT * FROM promocodes WHERE id = $1', [id]);

        if (promoCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Промокод не найден' });
        }

        // Обновляем промокод
        const updatedPromo = await pool.query(
            'UPDATE promocodes SET max_uses = $1, expires_at = $2 WHERE id = $3 RETURNING *',
            [max_uses || promoCheck.rows[0].max_uses, expires_at || promoCheck.rows[0].expires_at, id]
        );

        res.status(200).json(updatedPromo.rows[0]);
    } catch (error) {
        console.error('Ошибка при обновлении промокода:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;