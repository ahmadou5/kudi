import { FastifyInstance } from 'fastify';
import { apiRoutes } from '@kudi/api-contracts';
import { BalanceController } from './balance.controller';
import { requireSelfParam } from '../../utils/authGuards';

export async function balanceRoutes(
  server: FastifyInstance,
  controller: BalanceController
) {
  server.get(apiRoutes.users.balance(), { preHandler: requireSelfParam('userId') }, controller.getBalance);
  server.get('/api/users/:userId/balance', { preHandler: requireSelfParam('userId') }, controller.getBalance);
  server.get(apiRoutes.users.transactions(), { preHandler: requireSelfParam('userId') }, controller.getTransactions);
  server.get('/api/users/:userId/transactions', { preHandler: requireSelfParam('userId') }, controller.getTransactions);
  server.get(apiRoutes.users.virtualAccounts(), { preHandler: requireSelfParam('userId') }, controller.getVirtualAccounts);
  server.get('/api/users/:userId/virtual-accounts', { preHandler: requireSelfParam('userId') }, controller.getVirtualAccounts);
}
