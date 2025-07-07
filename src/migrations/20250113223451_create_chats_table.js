/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
    return knex.schema.createTable('chats', (table) => {
        table.increments('id').primary();
        table.integer('user1_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.integer('user2_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.boolean('is_active').defaultTo(true);
        table.timestamps(true, true); // created_at и updated_at
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function (knex) {
    return knex.schema.dropTable('chats');
};
