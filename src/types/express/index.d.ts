import '@types/express-serve-static-core';

// declare global {
//   namespace Express {
//     interface Request {
//       userId?: number;
//       userIsAdmin?: boolean;
//     }
//   }
// }

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: number;
      isAdmin?: boolean;
    };
  }
}
