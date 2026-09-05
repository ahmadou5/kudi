export async function pollRateEngine(): Promise<{ rawP2PRate: number; blendedRate: number }> {
  console.log('📈 [Rate Engine] Polling P2P market rates (USDC/USDT -> NGN)...');
  const mockP2PRate = 1590 + (Math.random() * 10 - 5);
  const spreadMultiplier = 0.99; // 1% spread margin
  const blendedRate = Math.floor(mockP2PRate * spreadMultiplier);

  console.log(`📊 [Rate Engine] Updated rate: 1 USDC = ₦${blendedRate} NGN (Raw P2P: ₦${mockP2PRate.toFixed(2)})`);
  return { rawP2PRate: mockP2PRate, blendedRate };
}
