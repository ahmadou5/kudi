import { FastifyInstance } from 'fastify';
import { KYCController } from './kyc.controller';

export async function kycRoutes(
  server: FastifyInstance,
  controller: KYCController
) {
  server.post('/api/v1/kyc/verify-id', controller.verifyID);
  server.post('/api/kyc/verify-id', controller.verifyID);
}
