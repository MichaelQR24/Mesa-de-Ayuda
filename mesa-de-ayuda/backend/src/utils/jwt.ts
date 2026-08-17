import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { UserRole } from '@prisma/client';

export interface TokenPayload {
  sub: string;
  email: string;
  displayName: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export function generateAccessToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: (env.ACCESS_TOKEN_TTL || '15m') as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
}
