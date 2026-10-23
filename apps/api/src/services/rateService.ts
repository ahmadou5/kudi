import { prisma } from '@kudi/database';

export interface FxRateResult {
  from: string;
  to: string;
  rate: number;
  updatedAt: string;
  isStale: boolean;
}

interface FxCacheEntry {
  rate: number;
  fetchedAt: number;
}

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

  private rateUpdateListeners: Array<(state: RateState) => void> = [];
  // In-memory FX cache: key = "EUR:USD", value = { rate, fetchedAt }
  private fxCache = new Map<string, FxCacheEntry>();
  private readonly FX_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  // Throttle for on-demand rate refresh (worker owns the actual polling loop)
  private lastRefreshAttemptAt = 0;
  private readonly REFRESH_MIN_INTERVAL_MS = 30_000;

  public getRateState(): RateState {
    return this.state;
  }

  public getCurrentRate(): number {
    return this.state.currentRateNGN;
  }

  /**
   * On-demand refresh of the in-memory NGN rate from the worker's latest
   * RateFeedLog row (falls back to provider APIs if the log is stale).
   * Throttled so request paths can call it freely. The API process must not
   * run its own polling loop — the worker's rate-poller queue owns cadence.
   */
  public async ensureFreshRate(): Promise<number> {
    if (this.state.isManualOverride) return this.state.currentRateNGN;
    const now = Date.now();
    if (now - this.lastRefreshAttemptAt < this.REFRESH_MIN_INTERVAL_MS) {
      return this.state.currentRateNGN;
    }
    this.lastRefreshAttemptAt = now;
    return this.fetchLiveRate();
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

  /**
   * Fetch a live FX rate for any currency pair (e.g. EUR→USD, GBP→USD, NGN→USD).
   * Results are cached for FX_CACHE_TTL_MS to avoid hammering providers.
   */
  public async getFxRate(from: string, to: string): Promise<FxRateResult> {
    const normalFrom = from.toUpperCase();
    const normalTo = to.toUpperCase();

    // Identity
    if (normalFrom === normalTo) {
      return { from: normalFrom, to: normalTo, rate: 1, updatedAt: new Date().toISOString(), isStale: false };
    }

    // Special case: use our internal engine for NGN↔USD (most accurate for the platform)
    if ((normalFrom === 'NGN' && normalTo === 'USD') || (normalFrom === 'USD' && normalTo === 'NGN')) {
      const ngnPerUsd = this.getCurrentRate();
      const rate = normalFrom === 'NGN' ? 1 / ngnPerUsd : ngnPerUsd;
      return {
        from: normalFrom,
        to: normalTo,
        rate,
        updatedAt: this.state.lastUpdated,
        isStale: this.state.isStale,
      };
    }

    const cacheKey = `${normalFrom}:${normalTo}`;
    const cached = this.fxCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.FX_CACHE_TTL_MS) {
      return {
        from: normalFrom,
        to: normalTo,
        rate: cached.rate,
        updatedAt: new Date(cached.fetchedAt).toISOString(),
        isStale: false,
      };
    }

    const providers: Array<{ name: string; fetch: () => Promise<number> }> = [
      {
        name: 'OpenER-API',
        fetch: async () => {
          const res = await fetch(`https://open.er-api.com/v6/latest/${normalFrom}`, {
            headers: { 'User-Agent': 'KudiRateEngine/1.0' },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as any;
          const rate = data?.rates?.[normalTo];
          if (rate && !isNaN(rate) && rate > 0) return Number(rate);
          throw new Error(`No ${normalTo} rate in OpenER-API response`);
        },
      },
      {
        name: 'ExchangeRate-API',
        fetch: async () => {
          const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${normalFrom}`, {
            headers: { 'User-Agent': 'KudiRateEngine/1.0' },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as any;
          const rate = data?.rates?.[normalTo];
          if (rate && !isNaN(rate) && rate > 0) return Number(rate);
          throw new Error(`No ${normalTo} rate in ExchangeRate-API response`);
        },
      },
      {
        name: 'Frankfurter',
        fetch: async () => {
          const res = await fetch(`https://api.frankfurter.app/latest?from=${normalFrom}&to=${normalTo}`, {
            headers: { 'User-Agent': 'KudiRateEngine/1.0' },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as any;
          const rate = data?.rates?.[normalTo];
          if (rate && !isNaN(rate) && rate > 0) return Number(rate);
          throw new Error(`No ${normalTo} rate in Frankfurter response`);
        },
      },
    ];

    for (const provider of providers) {
      try {
        const rate = await provider.fetch();
        this.fxCache.set(cacheKey, { rate, fetchedAt: Date.now() });
        return {
          from: normalFrom,
          to: normalTo,
          rate,
          updatedAt: new Date().toISOString(),
          isStale: false,
        };
      } catch (_err) {
        // Try next provider
      }
    }

    // All providers failed — return stale cache if we have one
    if (cached) {
      return {
        from: normalFrom,
        to: normalTo,
        rate: cached.rate,
        updatedAt: new Date(cached.fetchedAt).toISOString(),
        isStale: true,
      };
    }

    throw new Error(`Unable to fetch FX rate for ${normalFrom}→${normalTo} from any provider`);
  }
}

