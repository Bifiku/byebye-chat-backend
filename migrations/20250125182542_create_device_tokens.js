exports.up = function (knex) {
    return knex.schema.createTable('device_tokens', (table) => {
        table.increments('id').primary(); // Уникальный идентификатор записи
        table.integer('user_id').unsigned().notNullable(); // ID пользователя
        table.string('token', 255).notNullable().unique(); // Уникальный токен устройства
        table.timestamps(true, true); // Поля created_at и updated_at

        // Связь с таблицей пользователей
        table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable('device_tokens');
};
