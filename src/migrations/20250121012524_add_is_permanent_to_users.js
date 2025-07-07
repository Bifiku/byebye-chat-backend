exports.up = function(knex) {
    return knex.schema.table('users', (table) => {
        table.boolean('is_permanent').defaultTo(false).notNullable();
        table.string('email').unique();
        table.string('password');
    });
};

exports.down = function(knex) {
    return knex.schema.table('users', (table) => {
        table.dropColumn('is_permanent');
        table.dropColumn('email');
        table.dropColumn('password');
    });
};
