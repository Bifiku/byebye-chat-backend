// src/validators/password.ts
import { body } from 'express-validator';

import validate from '../helpers/validate';

export const forgotSchema = validate([
  body('username').optional().isString(),
  body('email').optional().isEmail(),
]);

export const codeSchema = validate([
  body('resetCode').isLength({ min: 5, max: 5 }),
  body('username').optional().isString(),
  body('email').optional().isEmail(),
]);

export const resetSchema = validate([
  body('newPassword').isLength({ min: 6 }),
  body('resetCode').isLength({ min: 5, max: 5 }),
  body('username').optional().isString(),
  body('email').optional().isEmail(),
]);
