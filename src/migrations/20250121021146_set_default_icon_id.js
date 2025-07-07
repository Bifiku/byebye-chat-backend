exports.up = function(knex) {
    return knex.schema.alterTable('users', (table) => {
        table.integer('icon_id').defaultTo(1).alter();
    });
};

exports.down = function(knex) {
    return knex.schema.alterTable('users', (table) => {
        table.integer('icon_id').alter();
    });
};
