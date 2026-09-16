import { FastifyReply, FastifyRequest } from 'fastify';
import { LedgerService } from '../../services/ledgerService';
import { RateService } from '../../services/rateService';
import { KYCTier } from '@kudi/types';
import { successResponse } from '../../utils/response';
import { dailyLimitForTier } from '../../utils/dailyLimits';

export class BalanceController {
  constructor(
    private ledgerService: LedgerService,
    private rateService: RateService
  ) {}

  public getBalance = async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    const balanceUSDC = await this.ledgerService.getBalanceAsync(userId);
    const user = this.ledgerService.getUser(userId);
    const tier = user?.kycTier || KYCTier.UNVERIFIED;
    const dailyLimitNGN = dailyLimitForTier(tier);
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

