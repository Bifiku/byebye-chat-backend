// src/utils/catchAsync
import { Request, Response, NextFunction, RequestHandler } from 'express';

/** async-контроллер может вернуть что угодно */
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const catchAsync =
  (fn: AsyncHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next))
      .then(() => undefined) // гарантируем Promise<void>
      .catch(next);
