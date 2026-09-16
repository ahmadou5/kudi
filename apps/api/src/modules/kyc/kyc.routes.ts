import { FastifyInstance } from 'fastify';
import { apiRoutes } from '@kudi/api-contracts';
import { KYCController } from './kyc.controller';
import { requireAuth } from '../../utils/authGuards';

export async function kycRoutes(
  server: FastifyInstance,
  controller: KYCController
) {
  server.post(apiRoutes.kyc.verifyId, { preHandler: requireAuth }, controller.verifyID);
  server.post('/api/kyc/verify-id', { preHandler: requireAuth }, controller.verifyID);
}
