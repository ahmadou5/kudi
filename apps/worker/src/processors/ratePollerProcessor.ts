import { prisma } from '@kudi/database';

export async function fetchLiveExchangeRate(): Promise<{ rawRate: number; source: string }> {
  const providers = [
    {
      name: 'CoinGecko (USDT/USDC)',
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
      name: 'OpenER-API (USD/NGN)',
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
      name: 'ExchangeRate-API (USD/NGN)',
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
      const rawRate = await provider.fetch();
      return { rawRate, source: provider.name };
    } catch (err: any) {
      console.warn(`[RateEngine] ⚠️ Provider ${provider.name} failed:`, err?.message || err);
    }
  }

  // Static baseline safety fallback if all live external APIs fail
  return { rawRate: 1585.50, source: 'STATIC_FALLBACK' };
}

export async function pollRateEngine(): Promise<{ rawP2PRate: number; blendedRate: number }> {
  console.log('📈 [Rate Engine] Polling live market rates (USDC/USDT -> NGN)...');

  const { rawRate, source } = await fetchLiveExchangeRate();
  const spreadMultiplier = 0.99; // 1% spread margin for liquidity buffer
  const blendedRate = Math.floor(rawRate * spreadMultiplier);

  console.log(`📊 [Rate Engine] Updated live rate (${source}): 1 USDC = ₦${blendedRate} NGN (Raw Market: ₦${rawRate.toFixed(2)})`);

  try {
    await prisma.rateFeedLog.create({
      data: {
        source,
        bidRate: rawRate,
        askRate: rawRate + 2,
        blendedRate: blendedRate,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ [Rate Engine] RateFeedLog skip: ${msg}`);
  }

  return { rawP2PRate: rawRate, blendedRate };
}

