exports.up = async function (knex) {
  await knex.schema.createTable('waiting_users', (table) => {
    table
      .integer('user_id')
      .unsigned()
      .primary()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.enu('gender', ['male', 'female', 'any']).nullable();
    table.enu('age_group', ['under_18', '18_30', '31_44', '45_plus']).nullable();
    table.enu('goal', ['talk', 'flirt', 'dating', 'any']).notNullable().defaultTo('any');
    table.timestamp('enqueued_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('waiting_users');
};
