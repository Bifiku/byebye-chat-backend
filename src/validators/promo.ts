import { body } from 'express-validator';

import validate from '../helpers/validate';

export const createSchema = validate([
  body('code').isLength({ min: 3 }),
  body('maxUses').optional().isInt({ min: 1 }),
]);

export const useSchema = validate([body('code').isString()]);

export const updateSchema = validate([
  body('maxUses').optional().isInt({ min: 1 }),
  body('expiresAt').optional().isISO8601(),
]);
