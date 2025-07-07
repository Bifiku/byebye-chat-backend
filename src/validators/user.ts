import { body } from 'express-validator';

import validate from '../helpers/validate';

export const createAnonSchema = validate([body('username').isLength({ min: 3 })]);

export const convertSchema = validate([
  body('username').isLength({ min: 3 }),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
]);

export const saveTokenSchema = validate([body('token').isString().notEmpty()]);
