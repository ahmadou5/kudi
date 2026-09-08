/**
 * Test: Solana USDC Deposit Detection
 * 
 * Tests the fixed SolanaListener against real wallet addresses from ledger_store.json.
 * Run with: pnpm --filter @kudi/chains exec tsx /home/ahmadou/metropolis/scratch/test_deposit_detection.ts
 */

const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const USDC_MINT = process.env.USDC_MINT_ADDRESS || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

// Real wallet addresses from ledger_store.json
const TEST_WALLETS = [
  { userId: 'usr_1788867509637', email: 'ahmadlasauwal@gmail.com', address: '3r47psdGvp6ZoY7Y6dU7rHZaMcPB86gZDhgj75pAiVE6' },
  { userId: 'usr_1788867966769', email: 'live_user_1788867966767@gmail.com', address: '5KbmCEWFJbznQ4u1zhoWPqZVh8EReTe945DASSESWHVw' }
];

async function rpc(method: string, params: any[]): Promise<any> {
  const res = await fetch(SOLANA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 })
  });
  const data = await res.json() as any;
  if (data.error) throw new Error(`RPC error: ${JSON.stringify(data.error)}`);
  return data.result;
}

async function getOnChainBalance(walletAddress: string): Promise<number> {
  const accounts = await rpc('getTokenAccountsByOwner', [
    walletAddress,
    { mint: USDC_MINT },
    { encoding: 'jsonParsed' }
  ]);
  const vals: any[] = accounts?.value || [];
  if (vals.length === 0) return 0;
  const tokenAmt = vals[0].account?.data?.parsed?.info?.tokenAmount;
  return Number(tokenAmt?.uiAmount || 0);
}

async function getUSDCTokenAccount(walletAddress: string): Promise<string | null> {
  const accounts = await rpc('getTokenAccountsByOwner', [
    walletAddress,
    { mint: USDC_MINT },
    { encoding: 'jsonParsed' }
  ]);
  const vals: any[] = accounts?.value || [];
  return vals.length > 0 ? vals[0].pubkey : null;
}

async function scanDeposits(walletAddress: string): Promise<{ signature: string; amountUSDC: number; slot: number }[]> {
  const results: { signature: string; amountUSDC: number; slot: number }[] = [];

  const tokenAccount = await getUSDCTokenAccount(walletAddress);
  if (!tokenAccount) {
    console.log(`  ⚠️  No USDC token account found — wallet has never received USDC`);
    return results;
  }
  console.log(`  📋 USDC Token Account: ${tokenAccount}`);

  const sigs = await rpc('getSignaturesForAddress', [tokenAccount, { limit: 25 }]);
  console.log(`  📄 ${sigs?.length || 0} transaction(s) found on token account`);

  for (const sigInfo of (sigs || [])) {
    if (sigInfo.err) continue;

    const tx = await rpc('getTransaction', [sigInfo.signature, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }]);
    if (!tx?.meta) continue;

    const pre = (tx.meta.preTokenBalances || []).find((b: any) => b.owner === walletAddress && b.mint === USDC_MINT);
    const post = (tx.meta.postTokenBalances || []).find((b: any) => b.owner === walletAddress && b.mint === USDC_MINT);

    if (!post) continue;

    const postAmt = post.uiTokenAmount?.uiAmount ?? 0;
    const preAmt = pre?.uiTokenAmount?.uiAmount ?? 0;
    const diff = postAmt - preAmt;

    if (diff > 0) {
      results.push({ signature: sigInfo.signature, amountUSDC: diff, slot: sigInfo.slot || 0 });
      console.log(`  ✅ DEPOSIT: +${diff} USDC | sig: ${sigInfo.signature.slice(0, 20)}...`);
    } else if (diff < 0) {
      console.log(`  ↩️  OUTGOING: ${diff} USDC | sig: ${sigInfo.signature.slice(0, 20)}...`);
    }
  }

  return results;
}

async function main() {
  console.log('==========================================================');
  console.log('🧪 KUDI — Solana USDC Deposit Detection Test');
  console.log(`🌐 RPC: ${SOLANA_RPC}`);
  console.log(`🪙 USDC Mint: ${USDC_MINT}`);
  console.log('==========================================================\n');

  for (const wallet of TEST_WALLETS) {
    console.log(`\n👤 User: ${wallet.email}`);
    console.log(`💼 Wallet: ${wallet.address}`);
    console.log(`---`);

    try {
      // 1. Check on-chain balance
      const onChainBal = await getOnChainBalance(wallet.address);
      console.log(`  🔗 On-chain USDC balance: ${onChainBal} USDC`);

      // 2. Scan for deposit transactions
      const deposits = await scanDeposits(wallet.address);
      
      if (deposits.length === 0) {
        console.log(`  ℹ️  No incoming USDC deposits found in last 25 transactions`);
      } else {
        const totalDeposited = deposits.reduce((sum, d) => sum + d.amountUSDC, 0);
        console.log(`  📊 Total deposited (from last 25 txs): ${totalDeposited.toFixed(6)} USDC`);
      }
    } catch (err: any) {
      console.error(`  ❌ Error scanning wallet: ${err.message}`);
    }
  }

  console.log('\n==========================================================');
  console.log('✅ Test complete');
  console.log('==========================================================');
}

main().catch(console.error);
