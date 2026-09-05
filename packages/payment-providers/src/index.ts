import { PaymentProvider, PaymentProviderId } from '@kudi/types';
import { PaystackProvider } from './paystack';
import { MonnifyProvider } from './monnify';
import { SquadProvider } from './squad';

export * from './paystack';
export * from './monnify';
export * from './squad';

export class PaymentProviderRegistry {
  private providers: Map<PaymentProviderId, PaymentProvider> = new Map();
  private activeProviderId: PaymentProviderId = PaymentProviderId.PAYSTACK;
  private failoverOrder: PaymentProviderId[] = [
    PaymentProviderId.PAYSTACK,
    PaymentProviderId.MONNIFY,
    PaymentProviderId.SQUAD
  ];

  constructor() {
    // Instantiate default providers
    this.registerProvider(new PaystackProvider());
    this.registerProvider(new MonnifyProvider());
    this.registerProvider(new SquadProvider());
  }

  public registerProvider(provider: PaymentProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getActiveProvider(): PaymentProvider {
    const provider = this.providers.get(this.activeProviderId);
    if (!provider) {
      throw new Error(`Active payment provider ${this.activeProviderId} is not registered.`);
    }
    return provider;
  }

  public getProvider(id: PaymentProviderId): PaymentProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new Error(`Payment provider ${id} is not registered.`);
    }
    return provider;
  }

  public setActiveProvider(id: PaymentProviderId): void {
    if (!this.providers.has(id)) {
      throw new Error(`Cannot set active provider to unregistered id: ${id}`);
    }
    this.activeProviderId = id;
  }

  public getActiveProviderId(): PaymentProviderId {
    return this.activeProviderId;
  }

  public setFailoverOrder(order: PaymentProviderId[]): void {
    this.failoverOrder = order;
  }

  public getFailoverOrder(): PaymentProviderId[] {
    return this.failoverOrder;
  }

  public async initiateTransferWithFailover(request: import('@kudi/types').TransferRequest): Promise<import('@kudi/types').TransferResponse> {
    const errors: string[] = [];

    // Attempt transfer starting with active provider, then iterate through failover order
    const providersToTry = [
      this.activeProviderId,
      ...this.failoverOrder.filter((id) => id !== this.activeProviderId)
    ];

    for (const providerId of providersToTry) {
      const provider = this.providers.get(providerId);
      if (!provider) continue;

      try {
        const response = await provider.initiateTransfer(request);
        if (response.status === 'success' || response.status === 'pending') {
          return response;
        }
        errors.push(`${provider.name}: ${response.message || 'Transfer failed'}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${provider.name}: ${msg}`);
      }
    }

    throw new Error(`All payout providers in failover chain failed: ${errors.join(' | ')}`);
  }
}
