import { prisma } from '@kudi/database';
import { PaymentProviderId } from '@kudi/types';
import type { PaymentProviderRegistry } from '@kudi/payment-providers';
import type { LedgerService } from './ledgerService';

const RECONCILE_INTERVAL_MS = 60_000;
const POLL_AGE_MS = 10 * 60 * 1000;
const PER_ROW_COOLDOWN_MS = 5 * 60 * 1000;
const BATCH_SIZE = 25;
const MAX_POLLS_PER_ROW = 24;

const KNOWN_PROVIDERS: PaymentProviderId[] = [
  PaymentProviderId.MONNIFY,
  PaymentProviderId.SQUAD,
  PaymentProviderId.BACHS
];

/**
 * Reconciles stuck bank-payout SpendTransactions (PENDING/PROCESSING) whose
 * provider status was never confirmed — webhook loss, provider outage, etc.
 * Settles via the same confirm/reverse paths the webhooks use, so refunds,
 * spend-limit release, and notifications stay consistent.
 */
export class PayoutReconcilerService {
  private timer?: NodeJS.Timeout;
  private lastPolledAt = new Map<string, number>();
  private pollCounts = new Map<string, number>();
  private running = false;

  constructor(
    private readonly ledgerService: LedgerService,
    private readonly paymentRegistry: PaymentProviderRegistry
  ) {}

  start(intervalMs: number = RECONCILE_INTERVAL_MS): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.reconcileOnce();
    }, intervalMs);
    this.timer.unref?.();
    console.log(`[PayoutReconciler] Started (interval=${intervalMs}ms, pollAge=${POLL_AGE_MS}ms)`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async reconcileOnce(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let settled = 0;
    try {
      const cutoff = new Date(Date.now() - POLL_AGE_MS);
      const rows = await prisma.spendTransaction.findMany({
        where: {
          status: { in: ['PENDING', 'PROCESSING'] },
          updatedAt: { lt: cutoff }
        },
        orderBy: { updatedAt: 'asc' },
        take: BATCH_SIZE
      });

      for (const row of rows) {
        try {
          const didSettle = await this.reconcileRow(row);
          if (didSettle) settled++;
        } catch (err: any) {
          console.warn(`[PayoutReconciler] Error checking ${row.reference}:`, err?.message || err);
        }
      }
    } catch (err: any) {
      console.warn('[PayoutReconciler] Query failed:', err?.message || err);
    } finally {
      this.running = false;
    }
    return settled;
  }

  private async reconcileRow(row: {
    reference: string;
    payoutProvider: string;
    status: string;
  }): Promise<boolean> {
    const providerId = row.payoutProvider?.toLowerCase() as PaymentProviderId;
    if (!providerId || !KNOWN_PROVIDERS.includes(providerId)) {
      return false;
    }

    const now = Date.now();
    const last = this.lastPolledAt.get(row.reference) || 0;
    if (now - last < PER_ROW_COOLDOWN_MS) return false;

    const polls = this.pollCounts.get(row.reference) || 0;
    if (polls >= MAX_POLLS_PER_ROW) {
      console.warn(
        `[PayoutReconciler] Giving up on ${row.reference} after ${polls} polls — still ${row.status}. Webhook can still settle it.`
      );
      return false;
    }

    this.lastPolledAt.set(row.reference, now);
    this.pollCounts.set(row.reference, polls + 1);

    const provider = this.paymentRegistry.getProvider(providerId);
    const res = await provider.checkTransferStatus(row.reference);

    if (res.status === 'success') {
      await this.ledgerService.confirmSpendTransaction(row.reference);
      this.cleanup(row.reference);
      console.log(`[PayoutReconciler] Confirmed ${row.reference} via ${providerId} (poll)`);
      return true;
    }
    if (res.status === 'failed') {
      await this.ledgerService.reverseSpendTransaction(row.reference, res.message || 'PAYOUT_POLL_FAILED');
      this.cleanup(row.reference);
      console.log(`[PayoutReconciler] Reversed ${row.reference} via ${providerId} (poll): ${res.message || ''}`);
      return true;
    }
    return false;
  }

  private cleanup(reference: string): void {
    this.lastPolledAt.delete(reference);
    this.pollCounts.delete(reference);
  }
}
