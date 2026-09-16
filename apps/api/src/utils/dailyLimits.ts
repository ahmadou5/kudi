import { KYCTier } from '@kudi/types';

export const DAILY_LIMITS_NGN: Record<KYCTier, number> = {
  [KYCTier.UNVERIFIED]: 0,
  [KYCTier.TIER_1]: 50000,
  [KYCTier.TIER_2]: 5000000
};

export interface DailyLimitCheck {
  amountNGN: number;
  limitNGN: number;
}

export function dailyLimitForTier(tier: KYCTier): number {
  return DAILY_LIMITS_NGN[tier] ?? 0;
}

export function buildDailyLimitCheck(tier: KYCTier, amountUSDC: number, exchangeRateNGN: number): DailyLimitCheck {
  return {
    amountNGN: Math.floor(amountUSDC * exchangeRateNGN),
    limitNGN: dailyLimitForTier(tier)
  };
}

export function formatDailyLimitMessage(amountNGN: number, spentTodayNGN: number, limitNGN: number, tier: KYCTier): string {
  return `Transaction amount ₦${amountNGN.toLocaleString()} NGN plus today's spend ₦${spentTodayNGN.toLocaleString()} NGN exceeds your ${tier} daily limit of ₦${limitNGN.toLocaleString()} NGN.`;
}

export function parseDailyLimitError(message: string): { spentTodayNGN: number; limitNGN: number; amountNGN: number } | null {
  if (!message.startsWith('DAILY_LIMIT_EXCEEDED:')) return null;
  const [, spentTodayNGN, limitNGN, amountNGN] = message.split(':');
  return {
    spentTodayNGN: Number(spentTodayNGN || 0),
    limitNGN: Number(limitNGN || 0),
    amountNGN: Number(amountNGN || 0)
  };
}
