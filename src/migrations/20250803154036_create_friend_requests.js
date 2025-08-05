// src/migrations/20250808_create_friend_requests.js

exports.up = async function (knex) {
  await knex.schema.createTable('friend_requests', (table) => {
    table.increments('id').primary();
    table
      .integer('from_user')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .integer('to_user')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.enu('status', ['pending', 'accepted', 'rejected']).notNullable().defaultTo('pending');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('responded_at').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('friend_requests');
};
