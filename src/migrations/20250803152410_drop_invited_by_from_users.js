/**
 * 20250804_drop_invited_by_from_users.js
 *
 * Удаляет устаревший столбец invited_by из users.
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    // сперва снимаем FK-ограничение
    table.dropForeign('invited_by');
    // затем сам столбец
    table.dropColumn('invited_by');
  });
};

exports.down = async function (knex) {
  // для отмены миграции — восстанавливаем invited_by
  await knex.schema.alterTable('users', (table) => {
    table.integer('invited_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
  });
};
