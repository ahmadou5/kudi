import { FastifyInstance } from 'fastify';
import { BalanceController } from './balance.controller';

export async function balanceRoutes(
  server: FastifyInstance,
  controller: BalanceController
) {
  server.get('/api/v1/users/:userId/balance', controller.getBalance);
  server.get('/api/users/:userId/balance', controller.getBalance);
  server.get('/api/v1/users/:userId/transactions', controller.getTransactions);
  server.get('/api/users/:userId/transactions', controller.getTransactions);
  server.get('/api/v1/users/:userId/virtual-accounts', controller.getVirtualAccounts);
  server.get('/api/users/:userId/virtual-accounts', controller.getVirtualAccounts);
}

