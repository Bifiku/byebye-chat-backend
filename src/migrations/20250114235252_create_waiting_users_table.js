exports.up = function(knex) {
    return knex.schema.createTable('waiting_users', (table) => {
        table.increments('id').primary();
        table.integer('user_id').notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('waiting_users');
};
