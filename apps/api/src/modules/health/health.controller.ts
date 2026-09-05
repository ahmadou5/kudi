import { FastifyReply, FastifyRequest } from 'fastify';
import { CustodyManager } from '@kudi/chains';
import { PaymentProviderRegistry } from '@kudi/payment-providers';

export class HealthController {
  constructor(
    private custodyManager: CustodyManager,
    private paymentRegistry: PaymentProviderRegistry
  ) {}

  public getHealth = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      service: 'kudi-api',
      custodyTrack: this.custodyManager.getActiveTrack(),
      activePaymentProvider: this.paymentRegistry.getActiveProviderId(),
      sentryEnabled: Boolean(process.env.SENTRY_DSN),
      timestamp: new Date().toISOString(),
    });
  };
}
