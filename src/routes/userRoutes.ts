// src/routes/userRoutes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';

import authMiddleware from '../middleware/authMiddleware';
import { getUserById, updateUser } from '../services/userService';

const router = Router();

// GET /api/v1/user
router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await getUserById(req.user?.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/user
router.patch(
  '/',
  authMiddleware,
  [
    body('fullname').optional().isString().notEmpty(),
    body('username').optional().isString().notEmpty(),
    body('email').optional().isEmail(),
    body('password').optional().isString().isLength({ min: 6 }),
    body('gender').optional().isIn(['male', 'female']),
    body('age_group').optional().isIn(['under_18', '18_30', '31_44', '45_plus']),
    body('language').optional().isIn(['EN', 'RU']),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    if (!req.user) {
      res.status(401).json({ error: 'Требуется авторизация' });
      return;
    }
    try {
      const updated = await updateUser(req.user.id, req.body);
      res.json(updated);
    } catch (err: any) {
      if (err.message.includes('taken')) {
        res.status(409).json({ error: err.message });
        return;
      }
      next(err);
    }
  },
);

export default router;
