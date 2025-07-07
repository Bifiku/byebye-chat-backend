const pool = require('./src/db');

(async () => {
  try {
    console.log('Начинается очистка базы данных...');

    // Удаляем данные из всех таблиц
    await pool.query('TRUNCATE users, messages, chats, waiting_users RESTART IDENTITY CASCADE');

    console.log('База данных успешно очищена.');
    process.exit(0); // Завершаем процесс без ошибок
  } catch (error) {
    console.error('Ошибка при очистке базы данных:', error);
    process.exit(1); // Завершаем процесс с ошибкой
  }
})();
