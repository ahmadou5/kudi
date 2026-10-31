import { FastifyInstance } from 'fastify';
import { apiRoutes } from '@kudi/api-contracts';
import { KYCController } from './kyc.controller';
import { requireAuth, requireSelfParam } from '../../utils/authGuards';

export async function kycRoutes(
  server: FastifyInstance,
  controller: KYCController
) {
  server.post(apiRoutes.kyc.verifyId, { preHandler: requireAuth }, controller.verifyID);
  server.post('/api/kyc/verify-id', { preHandler: requireAuth }, controller.verifyID);
  server.post(apiRoutes.kyc.session, { preHandler: requireAuth }, controller.createKycSession);
  server.post('/api/kyc/session', { preHandler: requireAuth }, controller.createKycSession);
  server.get(apiRoutes.kyc.sessionStatus, { preHandler: requireAuth }, controller.kycSessionStatus);
  server.get('/api/kyc/session/status', { preHandler: requireAuth }, controller.kycSessionStatus);
  server.get(apiRoutes.kyc.websdk, controller.serveKycWebSdk);
  server.get('/api/kyc/session/websdk', controller.serveKycWebSdk);
  server.post(apiRoutes.users.virtualAccounts(), { preHandler: requireSelfParam('userId') }, controller.retryVirtualAccount);
  server.post('/api/users/:userId/virtual-accounts', { preHandler: requireSelfParam('userId') }, controller.retryVirtualAccount);
}
