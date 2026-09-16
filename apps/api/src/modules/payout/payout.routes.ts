import { FastifyInstance } from 'fastify';
import { apiRoutes } from '@kudi/api-contracts';
import { PayoutController } from './payout.controller';
import { requireAuth } from '../../utils/authGuards';

export async function payoutRoutes(server: FastifyInstance, controller: PayoutController) {
  server.post(apiRoutes.payout.resolveAccount, { preHandler: requireAuth }, controller.resolveAccount);
  server.post('/api/payout/resolve-account', { preHandler: requireAuth }, controller.resolveAccount);
  server.get(apiRoutes.payout.banks, { preHandler: requireAuth }, controller.listBanks);
  server.get('/api/payout/banks', { preHandler: requireAuth }, controller.listBanks);
  server.post(apiRoutes.payout.spend, { preHandler: requireAuth }, controller.spendToBank);
  server.post('/api/payout/spend', { preHandler: requireAuth }, controller.spendToBank);
  server.post(apiRoutes.payout.spendUser, { preHandler: requireAuth }, controller.spendToUser);
  server.post('/api/payout/spend-user', { preHandler: requireAuth }, controller.spendToUser);
  server.post(apiRoutes.payout.spendOnChain, { preHandler: requireAuth }, controller.spendOnChain);
  server.post('/api/payout/spend-onchain', { preHandler: requireAuth }, controller.spendOnChain);
  server.get(apiRoutes.payout.cryptoStatus(), { preHandler: requireAuth }, controller.getCryptoWithdrawalStatus);
  server.get('/api/payout/crypto-status/:reference', { preHandler: requireAuth }, controller.getCryptoWithdrawalStatus);
  server.get(apiRoutes.payout.receipt(), { preHandler: requireAuth }, controller.getReceipt);
  server.get('/api/payout/receipt/:reference', { preHandler: requireAuth }, controller.getReceipt);
}
