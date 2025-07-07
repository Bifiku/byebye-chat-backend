import '@types/express-serve-static-core';

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      userIsAdmin?: boolean;
    }
  }
}
