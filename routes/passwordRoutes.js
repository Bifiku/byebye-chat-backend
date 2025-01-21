const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

router.post('/forgot-password', async (req, res) => {
    const { username, email } = req.body;

    if (!username && !email) {
        return res.status(400).json({ error: 'Username or email is required' });
    }

    try {
        // Находим пользователя
        const user = await pool.query(
            'SELECT * FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (!user.rows.length) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user_id = user.rows[0].id;
        const user_email = user.rows[0].email;

        // Генерируем уникальный код
        const resetCode = crypto.randomInt(10000, 99999).toString();

        // Сохраняем код в базе данных с ограничением времени
        await pool.query(
            'UPDATE users SET reset_code = $1, reset_code_expires = NOW() + INTERVAL \'10 minutes\' WHERE id = $2',
            [resetCode, user_id]
        );

        // Создаём HTML-сообщение
        const htmlMessage = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #3d97c6;">Byebye Chat: Сброс пароля</h2>
                <p>Здравствуйте, <strong>${username}</strong></p>
                <p>Вы запросили сброс пароля для своего аккаунта в Byebye Chat.</p>
                <p>Ваш код для сброса пароля:</p>
                <div style="font-size: 1.5em; font-weight: bold; color: #3d97c6;">${resetCode}</div>
                <p>Этот код действителен в течение <strong>10 минут</strong>.</p>
                <p>Если вы не запрашивали сброс пароля, проигнорируйте это сообщение.</p>
                <p>С уважением,</p>
                <p>Команда Byebye Chat</p>
            </div>
        `;

        // Отправляем письмо
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        await transporter.sendMail({
            from: `"Byebye Chat" <${process.env.EMAIL_USER}>`,
            to: user_email,
            subject: 'Сброс пароля в Byebye Chat',
            html: htmlMessage,
        });

        res.status(200).json({ message: 'Reset code sent to your email' });
    } catch (error) {
        console.error('Error sending reset code:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.post('/verify-reset-code', async (req, res) => {
    const { username, email, resetCode } = req.body;

    if (!resetCode || (!username && !email)) {
        return res.status(400).json({ error: 'Reset code and username or email are required' });
    }

    try {
        const user = await pool.query(
            'SELECT * FROM users WHERE (username = $1 OR email = $2) AND reset_code = $3 AND reset_code_expires > NOW()',
            [username, email, resetCode]
        );

        if (!user.rows.length) {
            return res.status(400).json({ error: 'Invalid or expired reset code' });
        }

        res.status(200).json({ message: 'Reset code verified successfully' });
    } catch (error) {
        console.error('Error verifying reset code:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/reset-password', async (req, res) => {
    const { username, email, resetCode, newPassword } = req.body;

    if (!resetCode || !newPassword || (!username && !email)) {
        return res.status(400).json({ error: 'Reset code, new password, and username or email are required' });
    }

    try {
        // Проверяем пользователя и код
        const user = await pool.query(
            'SELECT * FROM users WHERE (username = $1 OR email = $2) AND reset_code = $3 AND reset_code_expires > NOW()',
            [username, email, resetCode]
        );

        if (!user.rows.length) {
            return res.status(400).json({ error: 'Invalid or expired reset code' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Обновляем пароль и удаляем код сброса
        await pool.query(
            'UPDATE users SET password = $1, reset_code = NULL, reset_code_expires = NULL WHERE id = $2',
            [hashedPassword, user.rows[0].id]
        );

        res.status(200).json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


module.exports = router

