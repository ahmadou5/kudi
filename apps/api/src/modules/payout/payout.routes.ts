import { FastifyInstance } from 'fastify';
import { apiRoutes } from '@kudi/api-contracts';
import { PayoutController } from './payout.controller';

export async function payoutRoutes(server: FastifyInstance, controller: PayoutController) {
  server.post(apiRoutes.payout.resolveAccount, controller.resolveAccount);
  server.post('/api/payout/resolve-account', controller.resolveAccount);
  server.get(apiRoutes.payout.banks, controller.listBanks);
  server.get('/api/payout/banks', controller.listBanks);
  server.post(apiRoutes.payout.spend, controller.spendToBank);
  server.post('/api/payout/spend', controller.spendToBank);
  server.post(apiRoutes.payout.spendUser, controller.spendToUser);
  server.post('/api/payout/spend-user', controller.spendToUser);
  server.post(apiRoutes.payout.spendOnChain, controller.spendOnChain);
  server.post('/api/payout/spend-onchain', controller.spendOnChain);
  server.get(apiRoutes.payout.cryptoStatus(), controller.getCryptoWithdrawalStatus);
  server.get('/api/payout/crypto-status/:reference', controller.getCryptoWithdrawalStatus);
  server.get(apiRoutes.payout.receipt(), controller.getReceipt);
  server.get('/api/payout/receipt/:reference', controller.getReceipt);
}
