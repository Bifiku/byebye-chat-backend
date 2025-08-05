import bcrypt from 'bcrypt';
import { Router } from 'express';
import { body, validationResult } from 'express-validator';

import { catchAsync } from '../helpers/catchAsync';
import { issueTokens } from '../helpers/issueTokens';
import validate from '../helpers/validate';
import * as userRepo from '../repos/userRepo';
import * as authSvc from '../services/authService';
import { getInvitedById } from '../services/referralService';

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
    body('username')
      .exists()
      .withMessage('username обязателен')
      .bail()
      .isLength({ min: 3 })
      .withMessage('username слишком короткий'),
    body('email')
      .exists()
      .withMessage('email обязателен')
      .bail()
      .isEmail()
      .withMessage('Некорректный email'),
    body('password').exists().withMessage('password обязателен').bail().isLength({ min: 6 }),
    body('icon_id')
      .exists()
      .withMessage('icon_id обязателен')
      .bail()
      .toInt()
      .custom((value) => {
        if (Number.isNaN(value)) throw new Error('icon_id должен быть числом');
        if (!Number.isInteger(value) || value < 1)
          throw new Error('icon_id должен быть целым положительным числом');
        return true;
      }),
    body('referral_code').optional().isString(),
  ]),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    next();
  },
  catchAsync(async (req, res) => {
    const { username, email, password, icon_id, referral_code } = req.body;
    const invitedBy = referral_code ? await getInvitedById(referral_code) : null;

    if (referral_code && !invitedBy) {
      return res.status(400).json({ errors: [{ msg: 'Invalid referral code' }] });
    }
    res.status(201).json(await authSvc.register(username, email, password, icon_id, invitedBy));
  }),
);

/* --- ЛОГИН --- */
router.post(
  '/login',
  validate([
    body('username')
      .exists()
      .withMessage('username обязателен')
      .bail()
      .isLength({ min: 3 })
      .withMessage('username слишком короткий'),
    body('password').exists().withMessage('password обязателен').bail().isLength({ min: 6 }),
  ]),
  catchAsync(async (req, res) => {
    const { username, password } = req.body;
    const user = await userRepo.findByUsername(username);
    if (!user)
      return res.status(401).json({
        errors: [{ msg: 'Неверные имя пользователя или пароль' }],
      });
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        errors: [{ msg: 'Неверные имя пользователя или пароль' }],
      });
    }
    res.json(await issueTokens(user.id));
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
