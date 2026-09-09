/**
 * CryptoWithdrawalQueue
 *
 * A lightweight in-process job queue for crypto withdrawal broadcast jobs.
 * Jobs are enqueued by the API and processed asynchronously by the background processor.
 */

export interface CryptoWithdrawalJobData {
  reference: string;
  userId: string;
  amountUSDC: number;
  toAddress: string;
  chain: 'solana' | 'monad';
  enqueuedAt: string;
  attempts: number;
}

const MAX_RETRIES = 3;

export class CryptoWithdrawalQueue {
  private static instance: CryptoWithdrawalQueue;
  private queue: Map<string, CryptoWithdrawalJobData> = new Map();

  private constructor() {}

  public static getInstance(): CryptoWithdrawalQueue {
    if (!CryptoWithdrawalQueue.instance) {
      CryptoWithdrawalQueue.instance = new CryptoWithdrawalQueue();
    }
    return CryptoWithdrawalQueue.instance;
  }

  public enqueue(job: Omit<CryptoWithdrawalJobData, 'enqueuedAt' | 'attempts'>): CryptoWithdrawalJobData {
    const jobData: CryptoWithdrawalJobData = {
      ...job,
      enqueuedAt: new Date().toISOString(),
      attempts: 0
    };
    this.queue.set(job.reference, jobData);
    console.log(`[CryptoWithdrawalQueue] 📥 Enqueued withdrawal job: ${job.reference} (${job.amountUSDC} USDC to ${job.chain})`);
    return jobData;
  }

  public dequeueAll(): CryptoWithdrawalJobData[] {
    return Array.from(this.queue.values());
  }

  public getJob(reference: string): CryptoWithdrawalJobData | undefined {
    return this.queue.get(reference);
  }

  public recordAttempt(reference: string): boolean {
    const job = this.queue.get(reference);
    if (!job) return false;
    job.attempts += 1;
    if (job.attempts >= MAX_RETRIES) {
      this.queue.delete(reference);
      return false; // Exceeded max retries
    }
    return true; // Can retry
  }

  public remove(reference: string): void {
    this.queue.delete(reference);
    console.log(`[CryptoWithdrawalQueue] ✅ Removed job: ${reference}`);
  }

  public size(): number {
    return this.queue.size;
  }
}
