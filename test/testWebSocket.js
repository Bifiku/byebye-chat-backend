const WebSocket = require('ws');
const axios = require('axios');

const TOTAL_CLIENTS = 10; // Количество клиентов для тестирования
const API_URL_REGISTER = 'http://localhost:5000/api/v1/auth/register_anonymous';
const API_URL_DELETE = 'http://localhost:5000/api/v1/user/delete_account';
const WS_URL = 'ws://localhost:5000';
const clients = [];
const tokens = [];

// Регистрация анонимного пользователя
async function registerAnonymousClient(index) {
    try {
        const response = await axios.post(API_URL_REGISTER, {
            username: `test_user_${index}`,
            icon_id: 1,
        });
        return response.data.accessToken;
    } catch (error) {
        console.error(`Ошибка при регистрации клиента ${index}:`, error.response?.data || error.message);
        return null;
    }
}

// Удаление пользователя
async function deleteClient(token) {
    try {
        await axios.delete(API_URL_DELETE, {
            headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Пользователь успешно удалён.');
    } catch (error) {
        console.error('Ошибка при удалении пользователя:', error.response?.data || error.message);
    }
}

// Основной процесс тестирования
(async () => {
    for (let i = 0; i < TOTAL_CLIENTS; i++) {
        const token = await registerAnonymousClient(i);
        if (!token) {
            console.log(`Клиент ${i} не смог зарегистрироваться.`);
            continue;
        }

        tokens.push(token);

        const ws = new WebSocket(`${WS_URL}?token=${token}`);
        let missedPongs = 0;

        ws.on('open', () => {
            console.log(`Клиент ${i} подключён.`);
            ws.send(JSON.stringify({ type: 'find_partner' }));

            // Закрытие соединения через 20 секунд для тестирования
            setTimeout(() => {
                console.log(`Принудительное закрытие клиента ${i}.`);
                ws.terminate();
            }, 20000);
        });

        ws.on('message', (data) => {
            console.log(`Клиент ${i} получил сообщение:`, data);
        });

        ws.on('ping', () => {
            // Имитация отсутствия ответа на пинг каждые 3 итерации
            missedPongs++;
            if (missedPongs % 3 !== 0) {
                ws.pong();
            } else {
                console.log(`Клиент ${i} пропускает pong.`);
            }
        });

        ws.on('close', () => {
            console.log(`Клиент ${i} отключён.`);
        });

        ws.on('error', (error) => {
            console.error(`Клиент ${i} ошибка:`, error);
        });

        clients.push(ws);
    }

    // Закрываем соединения и удаляем пользователей через 1 минуту
    setTimeout(async () => {
        console.log('Закрываем все соединения...');
        clients.forEach((ws) => ws.close());

        for (const token of tokens) {
            await deleteClient(token);
        }

        console.log('Все пользователи удалены.');
    }, 5000);
})();
