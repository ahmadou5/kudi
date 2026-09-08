import { FastifyInstance } from 'fastify';
import { DepositsController } from './deposits.controller';

export async function depositsRoutes(
  server: FastifyInstance,
  controller: DepositsController
) {
  server.post('/api/v1/deposits/rescan', controller.rescan);
  server.get('/api/v1/deposits/balance/:address', controller.getOnChainBalance);
  server.get('/api/v1/deposits/treasury', controller.getTreasuryBalance);
}
