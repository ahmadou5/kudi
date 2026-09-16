import { FastifyInstance } from 'fastify';
import { apiRoutes } from '@kudi/api-contracts';
import { KYCController } from './kyc.controller';

export async function kycRoutes(
  server: FastifyInstance,
  controller: KYCController
) {
  server.post(apiRoutes.kyc.verifyId, controller.verifyID);
  server.post('/api/kyc/verify-id', controller.verifyID);
}
