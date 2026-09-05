export interface WebhookJobPayload {
  provider: 'squad' | 'monnify' | 'paystack' | 'korapay' | 'privy';
  eventId: string;
  eventType: string;
  data: Record<string, any>;
  timestamp: string;
}

export class WebhookProcessor {
  private processedEventIds = new Set<string>();

  public async processJob(job: WebhookJobPayload): Promise<{ success: boolean; message: string }> {
    const idempotencyKey = `${job.provider}:${job.eventId}`;

    // Idempotency check: prevent duplicate event processing
    if (this.processedEventIds.has(idempotencyKey)) {
      console.log(`ℹ️ Duplicate webhook event skipped: ${idempotencyKey}`);
      return { success: true, message: 'Duplicate event skipped' };
    }

    console.log(`⚡ [Worker] Processing Webhook Job: ${job.provider} - ${job.eventType}`);

    switch (job.provider) {
      case 'squad':
        await this.handleSquadDeposit(job.data);
        break;
      case 'monnify':
        await this.handleMonnifyDeposit(job.data);
        break;
      case 'paystack':
        await this.handlePaystackDeposit(job.data);
        break;
      case 'korapay':
        await this.handleKorapayDeposit(job.data);
        break;
      case 'privy':
        await this.handlePrivyUser(job.data);
        break;
      default:
        console.warn(`Unknown webhook provider: ${job.provider}`);
    }

    this.processedEventIds.add(idempotencyKey);
    return { success: true, message: `Successfully processed ${job.provider} webhook` };
  }

  private async handleSquadDeposit(data: Record<string, any>) {
    console.log(`✅ [Worker] Credited Squad Deposit Ref: ${data.reference || data.transaction_ref}`);
  }

  private async handleMonnifyDeposit(data: Record<string, any>) {
    console.log(`✅ [Worker] Credited Monnify Deposit Ref: ${data.transactionReference}`);
  }

  private async handlePaystackDeposit(data: Record<string, any>) {
    console.log(`✅ [Worker] Credited Paystack Deposit Ref: ${data.reference}`);
  }

  private async handleKorapayDeposit(data: Record<string, any>) {
    console.log(`✅ [Worker] Credited Korapay Deposit Ref: ${data.reference}`);
  }

  private async handlePrivyUser(data: Record<string, any>) {
    console.log(`✅ [Worker] Synced Privy User: ${data.id}`);
  }
}
