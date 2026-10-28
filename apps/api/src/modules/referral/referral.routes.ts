import { FastifyInstance } from 'fastify';
import { apiRoutes } from '@kudi/api-contracts';
import { requireAuth } from '../../utils/authGuards';
import { ReferralController } from './referral.controller';

export async function referralRoutes(server: FastifyInstance, controller: ReferralController) {
  server.get(apiRoutes.referral.overview, { preHandler: requireAuth }, controller.overview);
}
