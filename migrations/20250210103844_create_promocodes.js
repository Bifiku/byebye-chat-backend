exports.up = function(knex) {
    return knex.schema.createTable('promocodes', function(table) {
        table.increments('id').primary();
        table.string('code').unique().notNullable();
        table.integer('max_uses').nullable();
        table.integer('uses').defaultTo(0);
        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
    return knex.schema.dropTable('promocodes');
};
