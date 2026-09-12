import { FastifyReply, FastifyRequest } from 'fastify';
import { LedgerService } from '../../services/ledgerService';
import { RateService } from '../../services/rateService';
import { KYCTier } from '@kudi/types';
import { successResponse } from '../../utils/response';

const DAILY_LIMITS_NGN = {
  [KYCTier.UNVERIFIED]: 0,
  [KYCTier.TIER_1]: 50000,
  [KYCTier.TIER_2]: 5000000
};

export class BalanceController {
  constructor(
    private ledgerService: LedgerService,
    private rateService: RateService
  ) {}

  public getBalance = async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    const balanceUSDC = this.ledgerService.getBalance(userId);
    const user = this.ledgerService.getUser(userId);
    const tier = user?.kycTier || KYCTier.UNVERIFIED;
    const dailyLimitNGN = DAILY_LIMITS_NGN[tier];
    const currentRate = this.rateService.getCurrentRate();
    const spendableNGN = balanceUSDC * currentRate;

    return successResponse({
      userId,
      balanceUSDC: balanceUSDC.toFixed(2),
      currentRateNGN: currentRate,
      spendableNGN: Math.floor(spendableNGN),
      kycTier: tier,
      kycStatus: user?.kycStatus || 'NOT_STARTED',
      dailyLimitNGN,
      lastUpdated: this.rateService.getRateState().lastUpdated
    });
  };

  public getTransactions = async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    const transactions = await this.ledgerService.getUserTransactionsAsync(userId);
    return successResponse({ transactions, total: transactions.length });
  };

  public getVirtualAccounts = async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    const accounts = this.ledgerService.getUserVirtualAccounts(userId);
    return successResponse({ accounts });
  };
}

