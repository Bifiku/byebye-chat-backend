import { body } from 'express-validator';

import validate from '../helpers/validate';

export const genSchema = validate([body('maxUses').optional().isInt({ min: 1 })]);

export const useSchema = validate([body('referralCode').isString().isLength({ min: 6 })]);
