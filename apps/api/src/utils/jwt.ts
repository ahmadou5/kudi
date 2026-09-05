import { FastifyInstance } from 'fastify';

export interface TokenPayload {
  userId: string;
  email?: string;
  phoneNumber?: string;
}

export function signAccessToken(server: FastifyInstance, payload: TokenPayload): string {
  return server.jwt.sign(payload, { expiresIn: '24h' });
}

export function signRefreshToken(server: FastifyInstance, payload: TokenPayload): string {
  return server.jwt.sign(payload, { expiresIn: '30d' });
}
