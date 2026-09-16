import { FastifyReply, FastifyRequest } from 'fastify';
import { LedgerService } from '../../services/ledgerService';
import { RateService } from '../../services/rateService';
import { errorResponse, successResponse } from '../../utils/response';
import { generateReference } from '../../utils/hash';
import { getAuthenticatedUser } from '../../utils/authGuards';
import { KYCTier } from '@kudi/types';
import { buildDailyLimitCheck, formatDailyLimitMessage, parseDailyLimitError } from '../../utils/dailyLimits';

export class BillsController {
  constructor(
    private ledgerService: LedgerService,
    private rateService: RateService
  ) {}

  public payBill = async (request: FastifyRequest, reply: FastifyReply) => {
    const authUser = getAuthenticatedUser(request);
    const { billType, billerName, recipientIdentifier, amountNGN } = request.body as {
      userId?: string;
      billType: 'AIRTIME' | 'ELECTRICITY' | 'DATA';
      billerName: string;
      recipientIdentifier: string;
      amountNGN: number;
    };

    const userId = authUser?.userId;
    if (!userId) {
      return reply.status(401).send(errorResponse('UNAUTHORIZED', 'Authentication is required', 401));
    }

    const currentRate = this.rateService.getCurrentRate();
    const amountUSDC = amountNGN / currentRate;
    const user = this.ledgerService.getUser(userId);
    const tier = user?.kycTier || KYCTier.UNVERIFIED;
    const dailyLimit = { ...buildDailyLimitCheck(tier, amountUSDC, currentRate), sourceType: 'BILL_PAYMENT' };
    const reference = generateReference('BILL');

    try {
      await this.ledgerService.debitBalanceAtomic({
        userId,
        amountUSDC,
        reference,
        type: 'SPEND_DEBIT',
        metadata: {
          title: `${billType} Bill Payment`,
          subtitle: `${billerName} (${recipientIdentifier})`,
          amountNGN,
          exchangeRateNGN: currentRate,
          billType,
          billerName,
          recipientIdentifier
        },
        dailyLimit
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith('INSUFFICIENT_BALANCE:')) {
        return reply
          .status(400)
          .send(errorResponse('INSUFFICIENT_BALANCE', `Insufficient USDC balance for ₦${amountNGN} bill payment`, 400));
      }
      const limitError = parseDailyLimitError(message);
      if (limitError) {
        return reply.status(403).send(errorResponse(
          'DAILY_LIMIT_EXCEEDED',
          formatDailyLimitMessage(limitError.amountNGN, limitError.spentTodayNGN, limitError.limitNGN, tier),
          403
        ));
      }
      return reply.status(500).send(errorResponse('BILL_DEBIT_FAILED', message, 500));
    }

    return successResponse({
      receipt: {
        reference,
        billType,
        billerName,
        recipientIdentifier,
        amountNGN,
        amountUSDC: amountUSDC.toFixed(2),
        status: 'success'
      }
    });
  };
}
