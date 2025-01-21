const pool = require("../db");

async function getChat(userId, recipientId) {
    const chat = await pool.query(
        'SELECT * FROM chats WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)',
        [userId, recipientId]
    );
    return chat.rows[0];
}

async function createChat(userId, recipientId) {
    const chat = await pool.query(
        'INSERT INTO chats (user1_id, user2_id, is_active) VALUES ($1, $2, true) RETURNING *',
        [userId, recipientId]
    );
    return chat.rows[0];
}

async function verifyChatParticipant(chatId, userId) {
    const chat = await pool.query(
        'SELECT * FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
        [chatId, userId]
    );
    return chat.rows[0];
}

module.exports = {getChat, createChat, verifyChatParticipant}