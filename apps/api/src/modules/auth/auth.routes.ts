import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';

export async function authRoutes(
  server: FastifyInstance,
  controller: AuthController
) {
  server.post('/api/v1/auth/privy-authenticate', controller.authenticatePrivy);
  server.post('/api/v1/auth/privy-send-otp', controller.sendPrivyOTP);
  server.post('/api/v1/auth/privy-verify-otp', controller.verifyPrivyOTP);
  server.post('/api/v1/auth/refresh', controller.refreshToken);
  server.post('/api/v1/auth/pin/verify', controller.verifyPin);
  server.post('/api/v1/users/register', controller.registerUser);
  server.post('/api/users/register', controller.registerUser);
  server.post('/api/v1/users/set-pin', controller.setPin);
  server.post('/api/users/set-pin', controller.setPin);
  server.get('/api/v1/users/:userId', controller.getUserProfile);
  server.get('/api/users/:userId', controller.getUserProfile);
  server.patch('/api/v1/users/:userId', controller.updateUserProfile);
  server.post('/api/v1/users/:userId/profile', controller.updateUserProfile);
  server.patch('/api/users/:userId', controller.updateUserProfile);
}

