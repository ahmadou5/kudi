import { FastifyReply, FastifyRequest } from 'fastify';
import { CustodyManager } from '@kudi/chains';
import { PaymentProviderRegistry } from '@kudi/payment-providers';
import { PaymentProviderId } from '@kudi/types';
import { RateService } from '../../services/rateService';
import { errorResponse, successResponse } from '../../utils/response';

export class AdminController {
  constructor(
    private custodyManager: CustodyManager,
    private paymentRegistry: PaymentProviderRegistry,
    private rateService: RateService
  ) {}

  public getCurrentRates = async (request: FastifyRequest, reply: FastifyReply) => {
    return successResponse(this.rateService.getRateState());
  };

  public overrideRate = async (request: FastifyRequest, reply: FastifyReply) => {
    const { newRateNGN } = request.body as { newRateNGN: number };
    if (!newRateNGN || newRateNGN <= 0) {
      return reply.status(400).send(errorResponse('INVALID_RATE', 'Rate must be a positive number', 400));
    }
    const state = this.rateService.setRateOverride(newRateNGN);
    return successResponse({ rateState: state });
  };

  public getConfig = async (request: FastifyRequest, reply: FastifyReply) => {
    return successResponse({
      activePaymentProvider: this.paymentRegistry.getActiveProviderId(),
      custodyTrack: this.custodyManager.getActiveTrack(),
      failoverOrder: this.paymentRegistry.getFailoverOrder(),
      rateState: this.rateService.getRateState()
    });
  };

  public setActiveProvider = async (request: FastifyRequest, reply: FastifyReply) => {
    const { providerId } = request.body as { providerId: PaymentProviderId };
    this.paymentRegistry.setActiveProvider(providerId);
    return successResponse({ activeProviderId: this.paymentRegistry.getActiveProviderId() });
  };

  public exportReconciliationCSV = async (request: FastifyRequest, reply: FastifyReply) => {
    const rows = [
      ['Reference', 'UserId', 'AmountUSDC', 'ExchangeRateNGN', 'AmountNGN', 'Provider', 'Status', 'Timestamp'],
      ['KUDI_SPEND_1725423120000', 'usr_demo_123', '50.00', '1585.50', '79275', 'PAYSTACK', 'SUCCESS', new Date().toISOString()]
    ];

    const csvContent = rows.map((r) => r.join(',')).join('\n');
    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', 'attachment; filename="kudi_compliance_audit.csv"')
      .send(csvContent);
  };
}
