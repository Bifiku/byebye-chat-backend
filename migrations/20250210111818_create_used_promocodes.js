/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
exports.up = function (knex) {
    return knex.schema.createTable('used_promocodes', (table) => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
        table.integer('promo_id').unsigned().references('id').inTable('promocodes').onDelete('CASCADE');
        table.timestamp('used_at').defaultTo(knex.fn.now());
        table.unique(['user_id', 'promo_id']); // Запрещает повторное использование промокода одним пользователем
    });
};

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
exports.down = function (knex) {
    return knex.schema.dropTableIfExists('used_promocodes');
};
