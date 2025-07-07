exports.up = function(knex) {
    return knex.schema.alterTable('users', function(table) {
        table.integer('invited_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    });
};

exports.down = function(knex) {
    return knex.schema.alterTable('users', function(table) {
        table.dropColumn('invited_by');
    });
};
