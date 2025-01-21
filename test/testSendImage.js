const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const ws = new WebSocket('ws://158.160.79.246:5000', {
    headers: {
        Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJpYXQiOjE3Mzc0OTYzMjYsImV4cCI6MTc0MDA4ODMyNn0.zJZEN1DDewDWPzgzIepM1mzwA_D7Ov-Bd82vcrkt83Y`,
    },
});

ws.on('open', () => {
    console.log('WebSocket подключён.');

    const filePath = path.join(__dirname, 'test-image.jpg');

    // Читаем файл и конвертируем в Base64
    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.error('Ошибка при чтении файла:', err);
            return;
        }

        const base64File = data.toString('base64');

        // Отправляем сообщение с текстом и файлом
        ws.send(
            JSON.stringify({
                type: 'send_message',
                chat_id: 4,
                content: 'Привет, это сообщение с изображением!',
                file: {
                    name: 'test-image.jpg',
                    type: 'image/jpeg',
                    data: base64File, // Файл в формате Base64
                },
            })
        );
        console.log('Сообщение с изображением отправлено.');
    });
});

ws.on('message', (data) => {
    console.log('Ответ от сервера:', JSON.parse(data));
});

ws.on('close', () => {
    console.log('WebSocket закрыт.');
});

ws.on('error', (error) => {
    console.error('WebSocket ошибка:', error);
});
