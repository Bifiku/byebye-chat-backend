/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
exports.up = function (knex) {
    return knex.schema.alterTable('promocodes', (table) => {
        table.timestamp('expires_at').nullable(); // Дата окончания промокода (может быть null)
    });
};

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
exports.down = function (knex) {
    return knex.schema.alterTable('promocodes', (table) => {
        table.dropColumn('expires_at');
    });
};
