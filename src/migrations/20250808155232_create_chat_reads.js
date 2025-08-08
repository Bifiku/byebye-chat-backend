exports.up = async function (knex) {
  await knex.schema.createTable('chat_reads', (table) => {
    table
      .integer('chat_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('chats')
      .onDelete('CASCADE');
    table
      .integer('user_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .integer('last_read_message_id')
      .unsigned()
      .nullable()
      .references('id')
      .inTable('messages')
      .onDelete('SET NULL');
    table.timestamp('last_read_at').notNullable().defaultTo(knex.fn.now());
    table.primary(['chat_id', 'user_id']);
  });

  // курсорная пагинация по id (DESC)
  await knex.schema.alterTable('messages', (table) => {
    table.index(['chat_id', 'id'], 'messages_chat_id_id_idx');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('messages', (table) => {
    table.dropIndex(['chat_id', 'id'], 'messages_chat_id_id_idx');
  });
  await knex.schema.dropTableIfExists('chat_reads');
};
