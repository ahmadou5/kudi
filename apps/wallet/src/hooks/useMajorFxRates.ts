import { useQuery } from '@tanstack/react-query';
import { sdk } from '../lib/sdk';
import { MAJOR_CURRENCIES, MajorCurrency } from '../constants/currencies';

export interface CurrencyRate extends MajorCurrency {
  /** How many NGN one unit of `code` buys. */
  rate: number;
  updatedAt: string;
  isStale: boolean;
}

/**
 * Live NGN rates for the major currencies. Resolves every pair in parallel
 * against the platform FX endpoint (5-minute server-side cache, so a cold
 * screen costs one provider round-trip per currency).
 */
export function useMajorFxRates() {
  return useQuery<CurrencyRate[]>({
    queryKey: ['fx-rates', 'NGN', 'majors'],
    queryFn: async () => {
      const settled = await Promise.allSettled(
        MAJOR_CURRENCIES.map(async (currency: MajorCurrency) => {
          const res = await sdk.getFxRate(currency.code, 'NGN');
          const data = res?.data;
          if (!data?.rate || !isFinite(data.rate) || data.rate <= 0) {
            throw new Error(`Rate unavailable for ${currency.code}`);
          }
          return {
            ...currency,
            rate: data.rate,
            updatedAt: data.updatedAt,
            isStale: !!data.isStale
          };
        })
      );

      const rates = settled
        .filter((result): result is PromiseFulfilledResult<CurrencyRate> => result.status === 'fulfilled')
        .map((result) => result.value);

      if (rates.length === 0) throw new Error('Unable to load exchange rates');
      return rates;
    },
    staleTime: 30_000,
    refetchInterval: 60_000
  });
}
