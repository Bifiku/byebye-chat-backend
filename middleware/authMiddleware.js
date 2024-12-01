// ./middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1]; // токен в заголовке

    if (!token) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user_id = decoded.user_id; // Подставляем userId в запрос
        next();
    } catch (error) {
        console.error(error);
        res.status(403).json({ error: 'Недействительный токен' });
    }
}

module.exports = authMiddleware;
