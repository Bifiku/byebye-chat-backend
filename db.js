// db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.connect((err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных', err);
    } else {
        console.log('Подключение к базе данных установлено');
    }
});

module.exports = pool;
