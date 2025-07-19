import jwt from 'jsonwebtoken';

const ACCESS_TTL = '30d';
const REFRESH_TTL = '365d';

export function issueTokens(userId: number) {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: ACCESS_TTL });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: REFRESH_TTL,
  });
  return { accessToken, refreshToken };
}
