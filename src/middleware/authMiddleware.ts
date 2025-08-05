// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthenticatedRequest extends Request {
  user?: { id: number; isAdmin?: boolean };
}

const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }

  const token = header.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as jwt.JwtPayload & {
      userId: number;
      isAdmin?: boolean;
    };

    // Привязываем user
    req.user = {
      id: decoded.userId,
      isAdmin: decoded.isAdmin,
    };

    next();
  } catch {
    res.status(403).json({ error: 'Недействительный токен' });
    return;
  }
};

export default authMiddleware;
