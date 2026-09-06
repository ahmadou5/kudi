import { prisma } from '@kudi/database';

export async function pollRateEngine(): Promise<{ rawP2PRate: number; blendedRate: number }> {
  console.log('📈 [Rate Engine] Polling P2P market rates (USDC/USDT -> NGN)...');
  const mockP2PRate = 1590 + (Math.random() * 10 - 5);
  const spreadMultiplier = 0.99; // 1% spread margin
  const blendedRate = Math.floor(mockP2PRate * spreadMultiplier);

  console.log(`📊 [Rate Engine] Updated rate: 1 USDC = ₦${blendedRate} NGN (Raw P2P: ₦${mockP2PRate.toFixed(2)})`);

  try {
    await prisma.rateFeedLog.create({
      data: {
        source: 'P2P_BLENDED',
        bidRate: mockP2PRate,
        askRate: mockP2PRate + 2,
        blendedRate: blendedRate,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ [Rate Engine] RateFeedLog skip (DB connection or table not synced): ${msg}`);
  }

  return { rawP2PRate: mockP2PRate, blendedRate };
}
