exports.up = function (knex) {
    return knex.schema.alterTable('messages', (table) => {
        table.string('content_type').defaultTo('text'); // Тип сообщения (текст или изображение)
        table.string('file_url'); // URL файла
    });
};

exports.down = function (knex) {
    return knex.schema.alterTable('messages', (table) => {
        table.dropColumn('content_type');
        table.dropColumn('file_url');
    });
};
