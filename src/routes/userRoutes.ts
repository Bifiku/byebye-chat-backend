import { Router } from 'express';

import { catchAsync } from '../helpers/catchAsync';
import auth from '../middleware/authMiddleware';
import * as userSvc from '../services/userService';
import { createAnonSchema, convertSchema, saveTokenSchema } from '../validators/user';

const router = Router();

/* ─────────── 1. создать анонима (тестовый эндпоинт) ─────────── */
router.post(
  '/',
  createAnonSchema,
  catchAsync(async (req, res) => {
    const { username, icon_id } = req.body;
    const user = await userSvc.createAnonymous(username, icon_id);
    res.status(201).json(user);
  }),
);

/* ─────────── 2. получить профиль ─────────── */
router.get(
  '/:id',
  catchAsync(async (req, res) => {
    const profile = await userSvc.getProfile(Number(req.params.id));
    if (!profile) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(profile);
  }),
);

/* ─────────── 3. конвертировать в permanent ─────────── */
router.post(
  '/convert_to_permanent',
  auth,
  convertSchema,
  catchAsync(async (req, res) => {
    const { username, email, password } = req.body;
    await userSvc.convertToPermanent(req.userId!, username, email, password);
    res.json({ message: 'Converted' });
  }),
);

/* ─────────── 4. удалить аккаунт полностью ─────────── */
router.delete(
  '/delete_account',
  auth,
  catchAsync(async (req, res) => {
    await userSvc.deleteAccount(req.userId!);
    res.json({ message: 'Account deleted' });
  }),
);

/* ─────────── 5. сохранить токен устройства ─────────── */
router.post(
  '/save-token',
  auth,
  saveTokenSchema,
  catchAsync(async (req, res) => {
    await userSvc.saveDeviceToken(req.userId!, req.body.token);
    res.json({ message: 'Token saved' });
  }),
);

/* ─────────── 6. статистика приглашений ─────────── */
router.get(
  '/stats',
  auth,
  catchAsync(async (req, res) => {
    res.json(await userSvc.inviteStats(req.userId!));
  }),
);

/* ─────────── 7. список промо-кодов (только админ) ─────────── */
router.get(
  '/promos',
  auth,
  catchAsync(async (req, res) => {
    res.json(await userSvc.listPromos(req.userIsAdmin!));
  }),
);

export default router;
