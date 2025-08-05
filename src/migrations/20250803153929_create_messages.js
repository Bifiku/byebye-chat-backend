exports.up = async function (knex) {
  await knex.schema.createTable('messages', (table) => {
    table.increments('id').primary();
    table
      .integer('chat_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('chats')
      .onDelete('CASCADE');
    table
      .integer('sender_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.text('content').notNullable();
    table.enu('content_type', ['text', 'bot']).notNullable().defaultTo('text');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('read_at').nullable().comment('Время, когда сообщение было прочитано');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('messages');
};
