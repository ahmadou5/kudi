import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';

export async function authRoutes(
  server: FastifyInstance,
  controller: AuthController
) {
  server.post('/api/v1/auth/privy-authenticate', controller.authenticatePrivy);
  server.post('/api/v1/auth/refresh', controller.refreshToken);
  server.post('/api/v1/auth/pin/verify', controller.verifyPin);
  server.post('/api/users/register', controller.registerUser);
  server.post('/api/users/set-pin', controller.setPin);
}

