import 'dotenv/config';

const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const mint = process.env.USDC_MINT_ADDRESS || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const wallet = process.argv[2];

if (!wallet) {
  console.error('Usage: node scripts/check-solana-deposit.mjs <wallet-address>');
  process.exit(1);
}

async function rpc(method, params) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const data = await res.json();
  if (data.error) throw new Error(method + ' failed: ' + JSON.stringify(data.error));
  return data.result;
}

const accounts = await rpc('getTokenAccountsByOwner', [wallet, { mint }, { encoding: 'jsonParsed' }]);
console.log('RPC:', rpcUrl);
console.log('USDC mint:', mint);
console.log('Wallet:', wallet);
console.log('Token accounts:', accounts.value.length);

for (const item of accounts.value) {
  const amount = item.account?.data?.parsed?.info?.tokenAmount;
  console.log('- token account:', item.pubkey, 'balance:', amount?.uiAmountString ?? amount?.uiAmount ?? '0');
  const sigs = await rpc('getSignaturesForAddress', [item.pubkey, { limit: 10 }]);
  console.log('  recent signatures:', sigs.map((s) => s.signature));
}
