import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { issueTokens } from '../helpers/issueTokens';
import * as userRepo from '../repos/userRepo';

export async function registerAnon(username: string, iconId: number) {
  if (await userRepo.findByUsername(username)) throw new Error('USERNAME_TAKEN');

  const userId = await userRepo.createAnonymous(username, iconId);
  return issueTokens(userId);
}

export async function register(
  username: string,
  email: string,
  password: string,
  iconId: number,
  invitedBy: number | null,
) {
  if (await userRepo.findByUsername(username)) throw new Error('USERNAME_TAKEN');

  const hash = await bcrypt.hash(password, 10);
  const userId = await userRepo.createPermanent(username, email, hash, iconId, invitedBy);
  return issueTokens(userId);
}

export async function login(username: string, password: string) {
  const user = await userRepo.findByUsername(username);
  if (!user) throw new Error('NOT_FOUND');
  if (!(await bcrypt.compare(password, user.password))) throw new Error('BAD_PASSWORD');
  return issueTokens(user.id);
}

export async function refresh(refreshToken: string) {
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as jwt.JwtPayload & {
    userId: number;
  };

  const user = await userRepo.findByUsername(decoded.userId.toString());
  if (!user) throw new Error('NOT_FOUND');

  if (!user.is_permanent) {
    await userRepo.deleteAnonymous(user.id);
    throw new Error('ANON_EXPIRED');
  }

  const { accessToken } = issueTokens(user.id);
  return { accessToken };
}
