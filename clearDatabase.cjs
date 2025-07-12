#!/usr/bin/env node
const path = require('path');
// 1) регистрируем ts-node, чтобы require мог подхватить .ts
require('ts-node').register({
  project: path.resolve(__dirname, 'tsconfig.json'),
});

// 2) теперь подгружаем ваш пул из src/db.ts
const pool = require('./src/db.ts').default;

(async () => {
  try {
    console.log('Начинается очистка базы данных...');
    await pool.query('TRUNCATE users, messages, chats, waiting_users RESTART IDENTITY CASCADE');
    console.log('База данных успешно очищена.');
    process.exit(0);
  } catch (error) {
    console.error('Ошибка при очистке базы данных:', error);
    process.exit(1);
  }
})();
