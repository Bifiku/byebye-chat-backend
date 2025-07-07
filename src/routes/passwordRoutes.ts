import { Router } from 'express';

import { catchAsync } from '../helpers/catchAsync';
import * as pwdSvc from '../services/passwordService';
import { forgotSchema, codeSchema, resetSchema } from '../validators/password';

const router = Router();

/* 1 — запрос кода */
router.post(
  '/forgot-password',
  forgotSchema,
  catchAsync(async (req, res) => {
    const { username, email } = req.body;
    await pwdSvc.sendResetCode(username, email);
    res.status(200).json({ message: 'Reset code sent' });
  }),
);

/* 2 — проверка кода */
router.post(
  '/verify-reset-code',
  codeSchema,
  catchAsync(async (req, res) => {
    const { username, email, resetCode } = req.body;
    await pwdSvc.verifyCode(username, email, resetCode);
    res.status(200).json({ message: 'Reset code valid' });
  }),
);

/* 3 — смена пароля */
router.post(
  '/reset-password',
  resetSchema,
  catchAsync(async (req, res) => {
    const { username, email, resetCode, newPassword } = req.body;
    await pwdSvc.resetPassword(username, email, resetCode, newPassword);
    res.status(200).json({ message: 'Password updated' });
  }),
);

export default router;
