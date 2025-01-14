exports.up = function(knex) {
    return knex.schema.alterTable('messages', (table) => {
        table.dropColumn('is_read'); // Удаляем старое поле
        table.timestamp('read_at').nullable(); // Добавляем новое поле
    });
};

exports.down = function(knex) {
    return knex.schema.alterTable('messages', (table) => {
        table.dropColumn('read_at'); // Удаляем новое поле
        table.boolean('is_read').defaultTo(false); // Восстанавливаем старое поле
    });
};
