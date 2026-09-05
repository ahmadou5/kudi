import { FastifyReply, FastifyRequest } from 'fastify';
import { LedgerService } from '../../services/ledgerService';
import { RateService } from '../../services/rateService';
import { errorResponse, successResponse } from '../../utils/response';
import { generateReference } from '../../utils/hash';

export class BillsController {
  constructor(
    private ledgerService: LedgerService,
    private rateService: RateService
  ) {}

  public payBill = async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, billType, billerName, recipientIdentifier, amountNGN } = request.body as {
      userId: string;
      billType: 'AIRTIME' | 'ELECTRICITY' | 'DATA';
      billerName: string;
      recipientIdentifier: string;
      amountNGN: number;
    };

    const currentRate = this.rateService.getCurrentRate();
    const amountUSDC = amountNGN / currentRate;
    const currentBalance = this.ledgerService.getBalance(userId);

    if (currentBalance < amountUSDC) {
      return reply
        .status(400)
        .send(errorResponse('INSUFFICIENT_BALANCE', `Insufficient USDC balance for ₦${amountNGN} bill payment`, 400));
    }

    this.ledgerService.setBalance(userId, currentBalance - amountUSDC);
    const reference = generateReference('BILL');

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
