import { FastifyInstance } from 'fastify';
import { apiRoutes } from '@kudi/api-contracts';
import { AuthController } from './auth.controller';

export async function authRoutes(
  server: FastifyInstance,
  controller: AuthController
) {
  server.post(apiRoutes.auth.privyAuthenticate, controller.authenticatePrivy);
  server.post(apiRoutes.auth.privySendOtp, controller.sendPrivyOTP);
  server.post(apiRoutes.auth.privyVerifyOtp, controller.verifyPrivyOTP);
  server.post(apiRoutes.auth.refresh, controller.refreshToken);
  server.post(apiRoutes.auth.verifyPin, controller.verifyPin);
  server.post(apiRoutes.users.register, controller.registerUser);
  server.post('/api/users/register', controller.registerUser);
  server.post(apiRoutes.users.setPin, controller.setPin);
  server.post('/api/users/set-pin', controller.setPin);
  server.get(apiRoutes.users.byId(), controller.getUserProfile);
  server.get('/api/users/:userId', controller.getUserProfile);
  server.patch(apiRoutes.users.byId(), controller.updateUserProfile);
  server.post(apiRoutes.users.profile(), controller.updateUserProfile);
  server.patch('/api/users/:userId', controller.updateUserProfile);
  server.post(apiRoutes.auth.pushToken, controller.registerPushToken);
  server.post(apiRoutes.users.pushToken, controller.registerPushToken);
  server.post(apiRoutes.auth.testNotification, controller.testPushNotification);
  server.get(apiRoutes.users.notifications(), controller.getUserNotifications);
  server.patch(apiRoutes.users.markNotificationsRead(), controller.markAllNotificationsRead);
  server.patch(apiRoutes.users.markNotificationRead(), controller.markNotificationRead);
}
