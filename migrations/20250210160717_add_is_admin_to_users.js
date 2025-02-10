/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
exports.up = function (knex) {
    return knex.schema.alterTable('users', (table) => {
        table.boolean('is_admin').defaultTo(false); // По умолчанию false
    });
};

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
exports.down = function (knex) {
    return knex.schema.alterTable('users', (table) => {
        table.dropColumn('is_admin');
    });
};
