exports.up = knex =>
    knex.schema.createTable('users', t => {
        t.increments('id').primary();
        t.string('username').notNullable().unique();   // ← уникальность здесь
        t.integer('icon_id').notNullable();
        t.timestamps(true, true);
    });

exports.down = knex => knex.schema.dropTable('users');