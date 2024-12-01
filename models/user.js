// models/user.js
const pool = require('../db');

const createUser = async (username) => {
    const result = await pool.query(
        'INSERT INTO users (username) VALUES ($1) RETURNING *',
        [username]
    );
    return result.rows[0];
};

const getUserById = async (id) => {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
};

module.exports = { createUser, getUserById };
