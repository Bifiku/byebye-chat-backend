// src/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface Payload {
  userId: number;
  type: string;
}

export interface AuthRequest extends Request {
  user?: { id: number };
}

const JWT_SECRET = process.env.JWT_SECRET!;

export default function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const token = auth.slice(7);
  let payload: Payload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as Payload;
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  if (payload.type !== 'api') {
    res.status(401).json({ error: 'Invalid token type' });
    return;
  }
  req.user = { id: payload.userId };
  next();
}
