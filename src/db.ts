// db.js
import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('connect', () => console.log('Подключение к базе данных установлено'));
pool.on('error', (err) => console.error('Ошибка подключения к базе данных', err));

export default pool;
