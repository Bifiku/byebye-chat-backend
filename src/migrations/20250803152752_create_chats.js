/**
 * 20250805_create_chats.js
 *
 * Таблица chat’ов между двумя пользователями.
 */

exports.up = async function (knex) {
  await knex.schema.createTable('chats', (table) => {
    table.increments('id').primary();
    table
      .integer('user1_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .integer('user2_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.boolean('is_saved').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('expires_at').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('chats');
};
