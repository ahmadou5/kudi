import { FastifyInstance } from 'fastify';
import { apiRoutes } from '@kudi/api-contracts';
import { BalanceController } from './balance.controller';

export async function balanceRoutes(
  server: FastifyInstance,
  controller: BalanceController
) {
  server.get(apiRoutes.users.balance(), controller.getBalance);
  server.get('/api/users/:userId/balance', controller.getBalance);
  server.get(apiRoutes.users.transactions(), controller.getTransactions);
  server.get('/api/users/:userId/transactions', controller.getTransactions);
  server.get(apiRoutes.users.virtualAccounts(), controller.getVirtualAccounts);
  server.get('/api/users/:userId/virtual-accounts', controller.getVirtualAccounts);
}
