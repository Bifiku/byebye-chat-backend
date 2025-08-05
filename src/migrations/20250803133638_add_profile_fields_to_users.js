/**
 * 20250803_add_profile_fields_to_users.js
 *
 * Добавляет в users:
 *  - fullname,
 *  - gender,
 *  - age_group,
 *  - referral_code (7 символов A–Z0–9, уникальный),
 *  - inviter_id,
 *  - referrals_ids,
 *  - language
 */

exports.up = async function (knex) {
  // 1) Добавляем колонки без unique
  await knex.schema.alterTable('users', (table) => {
    table.text('fullname').notNullable().defaultTo('Anonymous');
    table.enu('gender', ['male', 'female', 'other']);
    table.enu('age_group', ['under_18', '18_30', '31_44', '45_plus']).nullable();
    // referral_code как VARCHAR(7)
    table.string('referral_code', 7).notNullable();
    table.integer('inviter_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.jsonb('referrals_ids').notNullable().defaultTo('[]');
    table.enu('language', ['EN', 'RU']).notNullable().defaultTo('EN');
  });

  // 2) Заполняем кодами для уже существующих записей
  const users = await knex('users').select('id');
  for (const { id } of users) {
    let code;
    let exists = true;
    // Генерим до тех пор, пока не найдём уникальный
    while (exists) {
      code = generateCode();
      const [{ count }] =
        (await knex('users').where('referral_code', code).count) < { count: string } > 'id';
      exists = Number(count) > 0;
    }
    await knex('users').where('id', id).update({ referral_code: code });
  }

  // 3) Наконец — добавляем уникальный индекс
  await knex.schema.alterTable('users', (table) => {
    table.unique('referral_code');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('language');
    table.dropColumn('referrals_ids');
    table.dropColumn('inviter_id');
    table.dropColumn('referral_code');
    table.dropColumn('age_group');
    table.dropColumn('gender');
    table.dropColumn('fullname');
  });
};
