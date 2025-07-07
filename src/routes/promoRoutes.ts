import { Router } from 'express';

import { catchAsync } from '../helpers/catchAsync';
import auth from '../middleware/authMiddleware';
import * as promoSvc from '../services/promoService';
import { createSchema, useSchema, updateSchema } from '../validators/promo';

const router = Router();

/* создать промокод (только админ) */
router.post(
  '/',
  auth,
  createSchema,
  catchAsync(async (req, res) => {
    const { code, maxUses } = req.body;
    const promo = await promoSvc.create(code, maxUses ?? null, req.userIsAdmin!);
    res.status(201).json(promo);
  }),
);

/* применить промокод */
router.post(
  '/use',
  auth,
  useSchema,
  catchAsync(async (req, res) => {
    await promoSvc.use(req.body.code);
    res.json({ message: 'Промокод применён' });
  }),
);

/* удалить промокод (только админ) */
router.delete(
  '/:id',
  auth,
  catchAsync(async (req, res) => {
    await promoSvc.remove(Number(req.params.id), req.userIsAdmin!);
    res.json({ ok: true });
  }),
);

/* изменить промокод (только админ) */
router.patch(
  '/:id',
  auth,
  updateSchema,
  catchAsync(async (req, res) => {
    const updated = await promoSvc.update(
      Number(req.params.id),
      req.body.maxUses ?? null,
      req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      req.userIsAdmin!,
    );
    res.json(updated);
  }),
);

export default router;
