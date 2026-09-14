const rpcUrl = 'https://api.devnet.solana.com';

async function checkAccount(addressStr) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [addressStr, { encoding: 'jsonParsed' }]
    })
  });
  const data = await res.json();
  return data.result ? data.result.value : null;
}

async function main() {
  const ata = '7BgFmrQagYaPUStwkH7VvMWfecFTCeCkYWb2w8LqoMAF';
  const info = await checkAccount(ata);
  console.log('ATA 7BgFmr... info:', JSON.stringify(info, null, 2));
}

main().catch(console.error);
