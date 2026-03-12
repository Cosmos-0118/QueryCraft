import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'crypto';
import { TOKEN_EXPIRY } from '@/lib/utils/constants';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return new TextEncoder().encode(secret);
};

export async function createAccessToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_EXPIRY.ACCESS}s`)
    .sign(getJwtSecret());
}

export async function verifyAccessToken(token: string): Promise<{ sub: string; email: string }> {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return { sub: payload.sub as string, email: payload.email as string };
}

export function generateRefreshToken(): string {
  return randomBytes(64).toString('hex');
}
