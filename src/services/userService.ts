import bcrypt from 'bcrypt';

import * as userRepo from '../repos/userRepo';

/** Создать аноним-пользователя */
export async function createAnonymous(username: string, iconId: number) {
  if (await userRepo.findByUsername(username)) throw new Error('USERNAME_TAKEN');
  const id = await userRepo.createAnonymous(username, iconId);
  return { id, username, iconId };
}

/** Профиль по id */
export const getProfile = (id: number) => userRepo.findById(id);

/** Конвертировать анонима в постоянного */
export async function convertToPermanent(
  id: number,
  username: string,
  email: string,
  password: string,
) {
  if (await userRepo.findByUsername(username)) throw new Error('USERNAME_TAKEN');
  const hash = await bcrypt.hash(password, 10);
  await userRepo.convertToPermanent(id, username, email, hash);
}

/** Удалить аккаунт полностью (чаты, сообщения, сам юзер) */
export const deleteAccount = (id: number) => userRepo.deleteAnonymous(id);

/** Сохранить токен устройства для push-уведомлений */
export const saveDeviceToken = (id: number, token: string) => userRepo.saveDeviceToken(id, token);

/** Сколько пользователей пришло по моей рефералке */
export const inviteStats = async (id: number) => {
  const rows = await userRepo.inviteStats(id);
  return { invitedCount: rows.length, users: rows };
};

/** Выгрузка всех промо-кодов (только для админа) */
export const listPromos = (isAdmin: boolean) => {
  if (!isAdmin) throw new Error('FORBIDDEN');
  return userRepo.listPromos();
};
