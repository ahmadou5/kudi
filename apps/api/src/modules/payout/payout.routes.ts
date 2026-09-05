import { FastifyInstance } from 'fastify';
import { PayoutController } from './payout.controller';

export async function payoutRoutes(server: FastifyInstance, controller: PayoutController) {
  server.post('/api/payout/resolve-account', controller.resolveAccount);
  server.get('/api/payout/banks', controller.listBanks);
  server.post('/api/payout/spend', controller.spendToBank);
  server.post('/api/payout/spend-user', controller.spendToUser);
  server.post('/api/payout/spend-onchain', controller.spendOnChain);
  server.get('/api/payout/receipt/:reference', controller.getReceipt);
}

