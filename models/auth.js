// models/auth.js
const jwt = require('jsonwebtoken');

function generateToken(user_id) {
    return jwt.sign({ user_id }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function extractUserIdFromToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Подписанный ключ из .env
        return decoded.user_id;
    } catch (error) {
        console.error('Ошибка при верификации токена:', error);
        return null;
    }
}

module.exports = { generateToken, extractUserIdFromToken };