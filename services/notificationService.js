// Функция для отправки уведомлений
const pool = require("../db");
const admin = require("../firebaseConfig");

const sendNotification = async (userId, title, body)  => {
    try {
        // Извлекаем токены устройства пользователя
        const tokensResult = await pool.query(
            'SELECT token FROM device_tokens WHERE user_id = $1',
            [userId]
        );

        const tokens = tokensResult.rows.map(row => row.token);

        if (tokens.length === 0) {
            console.log(`У пользователя с ID ${userId} нет активных токенов.`);
            return;
        }

        // Формируем сообщение
        const message = {
            notification: {
                title,
                body,
            },
            tokens, // Список токенов
        };

        // Отправляем уведомления
        const response = await admin.messaging().sendMulticast(message);
        console.log('Уведомления отправлены:', response);

        // Чистим невалидные токены
        await cleanInvalidTokens(response, tokens);
    } catch (error) {
        console.error('Ошибка при отправке уведомлений:', error);
    }
};

// Удаление невалидных токенов
const cleanInvalidTokens = async (response, tokens) => {
    const invalidTokens = response.responses
        .filter(r => !r.success)
        .map((r, index) => tokens[index]);

    if (invalidTokens.length > 0) {
        await pool.query('DELETE FROM device_tokens WHERE token = ANY($1::text[])', [invalidTokens]);
        console.log(`Удалено невалидных токенов: ${invalidTokens.length}`);
    }
};

module.exports = { sendNotification };
