import { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

const authMiddleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as jwt.JwtPayload & {
      userId: number;
    };

    req.userId = decoded.userId;
    req.userIsAdmin = decoded.isAdmin;

    next();
  } catch {
    res.status(403).json({ error: 'Недействительный токен' });
  }
};

export default authMiddleware;
