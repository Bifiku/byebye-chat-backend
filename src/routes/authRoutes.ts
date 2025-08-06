// src/routes/authRoutes.ts
import { Router } from 'express';
import { body, validationResult } from 'express-validator';

import { registerAnonymous, registerFull, login, refreshTokens } from '../services/authService';

const router = Router();

router.post('/register_anonymous', async (_req, res, next) => {
  try {
    const tokens = await registerAnonymous();
    res.status(201).json(tokens);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/register',
  [
    body('username').isString().notEmpty(),
    body('email').isEmail(),
    body('password').isString().isLength({ min: 6 }),
    body('referral_code').optional().isUUID(),
  ],
  async (req: any, res: any, next: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const tokens = await registerFull(req.body);
      res.status(201).json(tokens);
    } catch (err: any) {
      if (err.status) {
        res.status(err.status).json({ error: err.message });
      } else {
        next(err);
      }
    }
  },
);

router.post(
  '/login',
  [body('identifier').isString().notEmpty(), body('password').isString().notEmpty()],
  async (req: any, res: any, next: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const tokens = await login(req.body.identifier, req.body.password);
      res.json(tokens);
    } catch (err) {
      next(err);
    }
  },
);

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
