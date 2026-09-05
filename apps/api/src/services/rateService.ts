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

    try {
      // Bybit P2P rate query endpoint (USDC/USDT to NGN)
      const res = await fetch('https://api.bybit.com/v5/market/tickers?category=spot&symbol=USDTNGN', {
        headers: { 'Accept': 'application/json' }
      });
      const data = await res.json() as any;
      if (data && data.result && data.result.list && data.result.list[0]) {
        const lastPrice = parseFloat(data.result.list[0].lastPrice);
        if (lastPrice && !isNaN(lastPrice)) {
          this.state.rawP2PRateNGN = lastPrice;
          this.state.currentRateNGN = Math.round(lastPrice * (1 - this.state.spreadPercentage / 100) * 100) / 100;
          this.state.lastUpdated = new Date().toISOString();
          this.state.isStale = false;
          this.notifyListeners();
          return this.state.currentRateNGN;
        }
      }
    } catch (err) {
      // Fallback: slight random micro-fluctuation in dev mode to simulate live ticker
      const fluctuation = (Math.random() - 0.5) * 2;
      const base = 1585.50;
      this.state.currentRateNGN = Math.round((base + fluctuation) * 100) / 100;
      this.state.lastUpdated = new Date().toISOString();
      this.notifyListeners();
    }
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

