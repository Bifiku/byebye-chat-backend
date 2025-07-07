import { Router } from 'express';
import { query } from 'express-validator';

import { catchAsync } from '../helpers/catchAsync';
import validate from '../helpers/validate';
import * as userRepo from '../repos/userRepo';

const router = Router();

/* ────────── поиск пользователя по нику ────────── */
router.get(
  '/search',
  validate([query('username').isLength({ min: 3 })]),
  catchAsync(async (req, res) => {
    const { username } = req.query as { username: string };

    const user = await userRepo.findByUsername(username);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const { id, username: name, icon_id } = user;
    res.json({ id, username: name, icon_id });
  }),
);

export default router;
