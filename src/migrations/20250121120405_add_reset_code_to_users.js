exports.up = function(knex) {
    return knex.schema.table('users', (table) => {
        table.string('reset_code');
        table.timestamp('reset_code_expires');
    });
};

exports.down = function(knex) {
    return knex.schema.table('users', (table) => {
        table.dropColumn('reset_code');
        table.dropColumn('reset_code_expires');
    });
};
