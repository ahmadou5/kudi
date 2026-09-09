import { FastifyInstance } from 'fastify';
import { PayoutController } from './payout.controller';

export async function payoutRoutes(server: FastifyInstance, controller: PayoutController) {
  server.post('/api/v1/payout/resolve-account', controller.resolveAccount);
  server.post('/api/payout/resolve-account', controller.resolveAccount);
  server.get('/api/v1/payout/banks', controller.listBanks);
  server.get('/api/payout/banks', controller.listBanks);
  server.post('/api/v1/payout/spend', controller.spendToBank);
  server.post('/api/payout/spend', controller.spendToBank);
  server.post('/api/v1/payout/spend-user', controller.spendToUser);
  server.post('/api/payout/spend-user', controller.spendToUser);
  server.post('/api/v1/payout/spend-onchain', controller.spendOnChain);
  server.post('/api/payout/spend-onchain', controller.spendOnChain);
  server.get('/api/v1/payout/crypto-status/:reference', controller.getCryptoWithdrawalStatus);
  server.get('/api/payout/crypto-status/:reference', controller.getCryptoWithdrawalStatus);
  server.get('/api/v1/payout/receipt/:reference', controller.getReceipt);
  server.get('/api/payout/receipt/:reference', controller.getReceipt);
}
