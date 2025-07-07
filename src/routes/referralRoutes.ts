import { Router } from 'express';

import { catchAsync } from '../helpers/catchAsync';
import auth from '../middleware/authMiddleware';
import * as refSvc from '../services/referralService';
import { genSchema, useSchema } from '../validators/referral';

const router = Router();

/* создать код для приглашений */
router.post(
  '/create',
  auth,
  genSchema,
  catchAsync(async (req, res) => {
    const code = await refSvc.generate(req.userId!, req.body.maxUses ?? null);
    res.status(201).json(code);
  }),
);

/* применить код при регистрации / в профиле */
router.post(
  '/use',
  auth,
  useSchema,
  catchAsync(async (req, res) => {
    const ownerId = await refSvc.apply(req.body.referralCode);
    // можно начислить бонусы ownerId и req.userId здесь или в сервисе
    res.json({ message: 'Referral code applied', ownerId });
  }),
);

export default router;
