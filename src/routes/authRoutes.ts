// src/routes/authRoutes.ts
import { Router } from 'express';
import { body, validationResult } from 'express-validator';

import { registerAnonymous, registerFull, login, refreshTokens } from '../services/authService';

const router = Router();

// 1. Анонимная регистрация
router.post('/register_anonymous', async (_req, res, next) => {
  try {
    const tokens = await registerAnonymous();
    res.status(201).json(tokens);
  } catch (err) {
    next(err);
  }
});

// 2. Полная регистрация (конвертация анонима или новый аккаунт)
router.post(
  '/register',
  [
    body('username').isString().notEmpty(),
    body('email').isEmail(),
    body('password').isString().isLength({ min: 6 }),
    body('referral_code').optional().isString(),
  ],
  async (req: any, res: any, next: any) => {
    // проверка валидации
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, referral_code } = req.body;
    try {
      const tokens = await registerFull({ username, email, password, referral_code });
      res.status(201).json(tokens);
    } catch (err) {
      next(err);
    }
  },
);

// 3. Логин (по username или email + пароль)
router.post(
  '/login',
  [body('identifier').isString().notEmpty(), body('password').isString().notEmpty()],
  async (req: any, res: any, next: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { identifier, password } = req.body;
    try {
      const tokens = await login(identifier, password);
      res.json(tokens);
    } catch (err) {
      next(err);
    }
  },
);

// 4. Обновление токенов по refreshToken
router.post(
  '/refresh_token',
  [body('refreshToken').isString().notEmpty()],
  async (req: any, res: any, next: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const tokens = await refreshTokens(req.body.refreshToken);
      res.json(tokens);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
