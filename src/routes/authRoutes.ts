import { Router } from 'express';
import { body } from 'express-validator';

import { catchAsync } from '../helpers/catchAsync';
import validate from '../helpers/validate';
import * as authSvc from '../services/authService';

const router = Router();

/* --- АНOНИМ --- */
router.post(
  '/register_anonymous',
  validate([body('username').isLength({ min: 3 }), body('icon_id').isInt({ min: 1 })]),
  catchAsync(async (req, res) => {
    const { username, icon_id } = req.body;
    res.status(201).json(await authSvc.registerAnon(username, icon_id));
  }),
);

/* --- ПОЛНАЯ РЕГИСТРАЦИЯ --- */
router.post(
  '/register',
  validate([
    body('username').isLength({ min: 3 }),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('icon_id').isInt({ min: 1 }),
    body('referral_code').optional().isString(),
  ]),
  catchAsync(async (req, res) => {
    const { username, email, password, icon_id, referral_code } = req.body;
    const invitedBy = referral_code ? Number(await /* найти id по коду */ null) : null;
    res.status(201).json(await authSvc.register(username, email, password, icon_id, invitedBy));
  }),
);

/* --- ЛОГИН --- */
router.post(
  '/login',
  validate([body('username').notEmpty(), body('password').notEmpty()]),
  catchAsync(async (req, res) => {
    const { username, password } = req.body;
    res.json(await authSvc.login(username, password));
  }),
);

/* --- REFRESH --- */
router.post(
  '/refresh_token',
  validate([body('refreshToken').notEmpty()]),
  catchAsync(async (req, res) => {
    const { refreshToken } = req.body;
    res.json(await authSvc.refresh(refreshToken));
  }),
);

export default router;
