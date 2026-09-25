import { prisma } from '@kudi/database';

export interface RateState {
  currentRateNGN: number;
  rawP2PRateNGN: number;
  spreadPercentage: number;
  lastUpdated: string;
  isStale: boolean;
  isManualOverride: boolean;
}

export class RateService {
  private state: RateState = {
    currentRateNGN: 1585.50,
    rawP2PRateNGN: 1600.00,
    spreadPercentage: 0.9,
    lastUpdated: new Date().toISOString(),
    isStale: false,
    isManualOverride: false
  };

  private pollingTimer: NodeJS.Timeout | null = null;
  private rateUpdateListeners: Array<(state: RateState) => void> = [];

  public getRateState(): RateState {
    return this.state;
  }

  public getCurrentRate(): number {
    return this.state.currentRateNGN;
  }

  public setRateOverride(newRateNGN: number): RateState {
    this.state.currentRateNGN = newRateNGN;
    this.state.isManualOverride = true;
    this.state.lastUpdated = new Date().toISOString();
    this.notifyListeners();
    return this.state;
  }

  public onRateUpdate(listener: (state: RateState) => void) {
    this.rateUpdateListeners.push(listener);
  }

  private notifyListeners() {
    this.rateUpdateListeners.forEach(listener => listener(this.state));
  }

  public async fetchLiveRate(): Promise<number> {
    if (this.state.isManualOverride) return this.state.currentRateNGN;

    // Check database rate feed log first (e.g., populated by worker rate engine)
    try {
      const latestLog = await prisma.rateFeedLog.findFirst({
        orderBy: { createdAt: 'desc' }
      });
      if (latestLog && latestLog.blendedRate > 0) {
        const ageMs = Date.now() - new Date(latestLog.createdAt).getTime();
        if (ageMs < 15 * 60 * 1000) { // Fresh within 15 mins
          this.state.rawP2PRateNGN = Number(latestLog.bidRate);
          this.state.currentRateNGN = Number(latestLog.blendedRate);
          this.state.lastUpdated = new Date(latestLog.createdAt).toISOString();
          this.state.isStale = false;
          this.notifyListeners();
          return this.state.currentRateNGN;
        }
      }
    } catch (err: unknown) {
      // Ignore DB error, proceed to fetch directly from APIs
    }

    const providers = [
      {
        name: 'OpenER-API',
        fetch: async () => {
          const res = await fetch('https://open.er-api.com/v6/latest/USD', {
            headers: { 'User-Agent': 'KudiRateEngine/1.0' }
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as any;
          const rate = data?.rates?.NGN;
          if (rate && !isNaN(rate) && rate > 500) return Number(rate);
          throw new Error('Invalid rate payload from OpenER-API');
        }
      },
      {
        name: 'CoinGecko',
        fetch: async () => {
          const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether,usd-coin&vs_currencies=ngn', {
            headers: { 'User-Agent': 'KudiRateEngine/1.0' }
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as any;
          const rate = data?.tether?.ngn || data?.['usd-coin']?.ngn;
          if (rate && !isNaN(rate) && rate > 500) return Number(rate);
          throw new Error('Invalid rate payload from CoinGecko');
        }
      },
      {
        name: 'ExchangeRate-API',
        fetch: async () => {
          const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
            headers: { 'User-Agent': 'KudiRateEngine/1.0' }
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as any;
          const rate = data?.rates?.NGN;
          if (rate && !isNaN(rate) && rate > 500) return Number(rate);
          throw new Error('Invalid rate payload from ExchangeRate-API');
        }
      }
    ];

    for (const provider of providers) {
      try {
        const rawPrice = await provider.fetch();
        this.state.rawP2PRateNGN = rawPrice;
        this.state.currentRateNGN = Math.round(rawPrice * (1 - this.state.spreadPercentage / 100) * 100) / 100;
        this.state.lastUpdated = new Date().toISOString();
        this.state.isStale = false;
        this.notifyListeners();
        return this.state.currentRateNGN;
      } catch (err) {
        // Try next provider
      }
    }

    this.state.isStale = true;
    return this.state.currentRateNGN;
  }

  public startPolling(intervalMs = 30_000) {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.fetchLiveRate().catch(() => {});
    this.pollingTimer = setInterval(() => {
      this.fetchLiveRate().catch(() => {});
    }, intervalMs);
  }

  public stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }
}

