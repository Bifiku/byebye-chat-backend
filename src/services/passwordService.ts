import crypto from 'crypto';

import bcrypt from 'bcrypt';
import nodemailer from 'nodemailer';

import * as repo from '../repos/passwordRepo';

export async function sendResetCode(username?: string, email?: string) {
  const user = await repo.findByUsernameOrMail(username, email);
  if (!user) throw new Error('NOT_FOUND');

  const code = crypto.randomInt(10_000, 99_999).toString();
  await repo.saveResetCode(user.id, code);

  /** отправляем письмо */
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASSWORD!,
    },
  });

  await transporter.sendMail({
    from: `"Byebye Chat" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: 'Сброс пароля',
    html: template(user.username, code),
  });
}

export async function verifyCode(
  username: string | undefined,
  email: string | undefined,
  code: string,
) {
  const user = await repo.findByUsernameOrMail(username, email);
  if (!user) throw new Error('NOT_FOUND');
  if (!(await repo.verifyCode(user.id, code))) throw new Error('BAD_CODE');
}

export async function resetPassword(
  username: string | undefined,
  email: string | undefined,
  code: string,
  newPassword: string,
) {
  const user = await repo.findByUsernameOrMail(username, email);
  if (!user) throw new Error('NOT_FOUND');
  if (!(await repo.verifyCode(user.id, code))) throw new Error('BAD_CODE');

  const hash = await bcrypt.hash(newPassword, 10);
  await repo.updatePassword(user.id, hash);
}

/* ---------- helpers ---------- */

function template(username: string, code: string) {
  return `
    <div style="font-family: Arial, sans-serif; color:#333;">
      <h2 style="color:#3d97c6;">Byebye Chat: Сброс пароля</h2>
      <p>Здравствуйте, <strong>${username}</strong>.</p>
      <p>Ваш код для сброса пароля:</p>
      <div style="font-size:1.5em;font-weight:bold;color:#3d97c6;">${code}</div>
      <p>Действителен 10&nbsp;минут.</p>
    </div>`;
}
