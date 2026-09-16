import { FastifyInstance } from 'fastify';
import { DepositsController } from './deposits.controller';
import { requireAdmin } from '../../utils/authGuards';

export async function depositsRoutes(
  server: FastifyInstance,
  controller: DepositsController
) {
  server.post('/api/v1/deposits/rescan', { preHandler: requireAdmin }, controller.rescan);
  server.get('/api/v1/deposits/balance/:address', { preHandler: requireAdmin }, controller.getOnChainBalance);
  server.get('/api/v1/deposits/treasury', { preHandler: requireAdmin }, controller.getTreasuryBalance);
}
