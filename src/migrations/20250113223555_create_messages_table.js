/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable('messages', (table) => {
        table.increments('id').primary();
        table.integer('chat_id').notNullable().references('id').inTable('chats').onDelete('CASCADE');
        table.integer('sender_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.text('content').notNullable();
        table.boolean('is_read').defaultTo(false);
        table.timestamps(true, true); // created_at и updated_at
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTable('messages');
};
