import { FastifyInstance } from 'fastify';
import { apiRoutes } from '@kudi/api-contracts';
import { AuthController } from './auth.controller';
import { requireAuth, requireAdmin, requireSelfParam } from '../../utils/authGuards';

export async function authRoutes(
  server: FastifyInstance,
  controller: AuthController
) {
  server.post(apiRoutes.auth.login, controller.login);
  server.post('/api/v1/auth/setup-admin', controller.setupAdmin);
  server.post('/api/auth/setup-admin', controller.setupAdmin);
  server.post('/api/auth/login', controller.login);
  server.post(apiRoutes.auth.privyAuthenticate, controller.authenticatePrivy);
  server.post(apiRoutes.auth.privySendOtp, controller.sendPrivyOTP);
  server.post(apiRoutes.auth.privyVerifyOtp, controller.verifyPrivyOTP);
  server.post(apiRoutes.auth.refresh, controller.refreshToken);
  server.post(apiRoutes.auth.verifyPin, { preHandler: requireAuth }, controller.verifyPin);
  server.post(apiRoutes.users.register, controller.registerUser);
  server.post('/api/users/register', controller.registerUser);
  server.post(apiRoutes.users.setPin, { preHandler: requireAuth }, controller.setPin);
  server.post('/api/users/set-pin', { preHandler: requireAuth }, controller.setPin);
  server.get(apiRoutes.users.byId(), { preHandler: requireSelfParam('userId') }, controller.getUserProfile);
  server.get('/api/users/:userId', { preHandler: requireSelfParam('userId') }, controller.getUserProfile);
  server.patch(apiRoutes.users.byId(), { preHandler: requireSelfParam('userId') }, controller.updateUserProfile);
  server.post(apiRoutes.users.profile(), { preHandler: requireSelfParam('userId') }, controller.updateUserProfile);
  server.patch('/api/users/:userId', { preHandler: requireSelfParam('userId') }, controller.updateUserProfile);
  server.post(apiRoutes.auth.pushToken, { preHandler: requireAuth }, controller.registerPushToken);
  server.post(apiRoutes.users.pushToken, { preHandler: requireAuth }, controller.registerPushToken);
  server.post(apiRoutes.auth.testNotification, { preHandler: requireAdmin }, controller.testPushNotification);
  server.get(apiRoutes.users.notifications(), { preHandler: requireSelfParam('userId') }, controller.getUserNotifications);
  server.patch(apiRoutes.users.markNotificationsRead(), { preHandler: requireSelfParam('userId') }, controller.markAllNotificationsRead);
  server.patch(apiRoutes.users.markNotificationRead(), { preHandler: requireSelfParam('userId') }, controller.markNotificationRead);
}
