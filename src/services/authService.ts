import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import * as userRepo from '../repos/userRepo';

const ACCESS_TTL = '30d';
const REFRESH_TTL = '365d';

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

/* helpers */
function issueTokens(userId: number) {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: ACCESS_TTL });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: REFRESH_TTL,
  });
  return { accessToken, refreshToken };
}
