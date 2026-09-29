/**
 * scripts/test-treasury-fee-payer.mjs
 *
 * Validates TREASURY_FEE_PAYER mode end-to-end against Privy and the real RPC
 * before you flip GAS_PAYMENT_MODE=TREASURY_FEE_PAYER in production.
 *
 * Usage:
 *   node scripts/test-treasury-fee-payer.mjs solana <depositWalletPrivyId> <depositWalletAddress>
 *   node scripts/test-treasury-fee-payer.mjs monad   <depositWalletPrivyId> <depositWalletAddress>
 *
 * Required env (same as worker):
 *   PRIVY_APP_ID, PRIVY_APP_SECRET
 *   SOLANA_RPC_URL, SOLANA_CAIP2, USDC_MINT_ADDRESS
 *   KUDI_TREASURY_SOLANA_ADDRESS, KUDI_SOLANA_TREASURY_WALLET_ID
 *   MONAD_RPC_URL, MONAD_CHAIN_ID, AUSD_TOKEN_ADDRESS
 *   KUDI_TREASURY_EVM_ADDRESS, KUDI_EVM_TREASURY_WALLET_ID
 *
 * By default the script does NOT move real USDC — it uses amount=0 to test
 * signing surfaces only. Pass --wet as the last arg for a real $0.01 sweep.
 */

import 'dotenv/config';

const [,, chain, depositWalletId, depositWalletAddress, ...flags] = process.argv;
const WET = flags.includes('--wet');
const AMOUNT_USDC = WET ? 0.01 : 0;

if (!chain || !depositWalletId || !depositWalletAddress) {
  console.error('Usage: node scripts/test-treasury-fee-payer.mjs <solana|monad> <depositWalletPrivyId> <depositWalletAddress> [--wet]');
  process.exit(1);
}

const PRIVY_APP_ID     = process.env.PRIVY_APP_ID || '';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || '';
if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
  console.error('PRIVY_APP_ID and PRIVY_APP_SECRET must be set.');
  process.exit(1);
}

const authHeader = `Basic ${Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64')}`;

function privyRpc(walletId, body) {
  return fetch(`https://api.privy.io/v1/wallets/${walletId}/rpc`, {
    method: 'POST',
    headers: {
      'privy-app-id': PRIVY_APP_ID,
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

// ─── SOLANA TEST ──────────────────────────────────────────────────────────────

async function testSolana() {
  const RPC           = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const CAIP2         = process.env.SOLANA_CAIP2 || 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
  const TREASURY_ADDR = process.env.KUDI_TREASURY_SOLANA_ADDRESS;
  const TREASURY_ID   = process.env.KUDI_SOLANA_TREASURY_WALLET_ID;

  if (!TREASURY_ADDR || !TREASURY_ID) {
    console.error('KUDI_TREASURY_SOLANA_ADDRESS and KUDI_SOLANA_TREASURY_WALLET_ID required.');
    process.exit(1);
  }

  console.log('\n=== SOLANA TREASURY_FEE_PAYER TEST ===');
  console.log('Deposit wallet: ', depositWalletAddress, `(Privy: ${depositWalletId})`);
  console.log('Treasury wallet:', TREASURY_ADDR, `(Privy: ${TREASURY_ID})`);
  console.log('');

  // Fetch blockhash
  const bhRes  = await fetch(RPC, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestBlockhash', params: [{ commitment: 'processed' }] }),
  });
  const bhData = await bhRes.json();
  const blockhash = bhData.result?.value?.blockhash;
  if (!blockhash) throw new Error('Failed to fetch blockhash: ' + JSON.stringify(bhData));
  console.log('[1] Blockhash:', blockhash.slice(0, 16) + '...');

  // signMessage on treasury wallet — surface check
  console.log('\n[2] signMessage on treasury wallet (surface check)');
  const sm1Res = await privyRpc(TREASURY_ID, {
    method: 'signMessage', caip2: CAIP2,
    params: { message: Buffer.from(`TreasuryTest-${Date.now()}`).toString('base64'), encoding: 'base64' }
  });
  const sm1Text = await sm1Res.text();
  if (!sm1Res.ok) {
    console.error('  FAIL:', sm1Text.slice(0, 300));
  } else {
    const d = JSON.parse(sm1Text);
    console.log('  OK — signature:', (d?.data?.signature || d?.signature)?.slice(0, 20) + '...');
  }

  // signMessage on deposit wallet — surface check
  console.log('\n[3] signMessage on deposit wallet (surface check)');
  const sm2Res = await privyRpc(depositWalletId, {
    method: 'signMessage', caip2: CAIP2,
    params: { message: Buffer.from(`DepositTest-${Date.now()}`).toString('base64'), encoding: 'base64' }
  });
  const sm2Text = await sm2Res.text();
  if (!sm2Res.ok) {
    console.error('  FAIL:', sm2Text.slice(0, 300));
  } else {
    const d = JSON.parse(sm2Text);
    console.log('  OK — signature:', (d?.data?.signature || d?.signature)?.slice(0, 20) + '...');
  }

  // signTransaction surface check on treasury — probe method availability
  console.log('\n[4] signTransaction method availability on treasury wallet');
  // Build a minimal dummy wire tx — will be rejected by simulation but proves the method exists
  const dummyWire = Buffer.concat([Buffer.from([1]), Buffer.alloc(64), Buffer.from([0x80, 0x01, 0x00, 0x01])]);
  const st1Res = await privyRpc(TREASURY_ID, {
    method: 'signTransaction', caip2: CAIP2,
    params: { transaction: dummyWire.toString('base64'), encoding: 'base64' }
  });
  const st1Text = await st1Res.text();
  console.log('  HTTP status:', st1Res.status);
  if (st1Res.status === 404 || st1Text.includes('method not found') || st1Text.includes('Method not found')) {
    console.error('  FAIL: signTransaction method NOT supported — cannot use TREASURY_FEE_PAYER on Solana.');
    console.error('        Response:', st1Text.slice(0, 200));
  } else {
    console.log('  OK: Privy reached the signing layer (rejection of dummy tx is expected).');
    console.log('      signTransaction IS supported. Response:', st1Text.slice(0, 150));
  }

  console.log('\n=== SOLANA TEST COMPLETE ===');
  console.log('Next: run a real tiny sweep (selfCustody.ts with GAS_PAYMENT_MODE=TREASURY_FEE_PAYER)');
  console.log('to confirm the two-signTransaction composition round-trips correctly.');
}

// ─── MONAD / EVM TEST ─────────────────────────────────────────────────────────

async function testMonad() {
  const RPC           = process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';
  const CHAIN_ID      = Number(process.env.MONAD_CHAIN_ID || 10143);
  const AUSD          = process.env.AUSD_TOKEN_ADDRESS || '0x534b2f3A21130d7a60830c2Df862319e593943A3';
  const TREASURY_ADDR = process.env.KUDI_TREASURY_EVM_ADDRESS;
  const TREASURY_ID   = process.env.KUDI_EVM_TREASURY_WALLET_ID;
  const MULTICALL3    = '0xcA11bde05977b3631167028862bE2a173976CA11';

  if (!TREASURY_ADDR || !TREASURY_ID) {
    console.error('KUDI_TREASURY_EVM_ADDRESS and KUDI_EVM_TREASURY_WALLET_ID required.');
    process.exit(1);
  }

  console.log('\n=== MONAD EVM TREASURY_FEE_PAYER TEST ===');
  console.log('Chain ID:        ', CHAIN_ID);
  console.log('AUSD contract:   ', AUSD);
  console.log('Multicall3:      ', MULTICALL3);
  console.log('Deposit wallet:  ', depositWalletAddress, `(Privy: ${depositWalletId})`);
  console.log('Treasury wallet: ', TREASURY_ADDR, `(Privy: ${TREASURY_ID})`);
  console.log('Amount:          ', AMOUNT_USDC, 'USDC', WET ? '(WET RUN)' : '(DRY — signing only)');
  console.log('');

  async function rpcCall(method, params) {
    const res = await fetch(RPC, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    return res.json();
  }

  // 1. nonces()
  const nonceCalldata = `0x7ecebe00${depositWalletAddress.replace('0x', '').padStart(64, '0')}`;
  const nonceData = await rpcCall('eth_call', [{ to: AUSD, data: nonceCalldata }, 'latest']);
  if (nonceData.error) { console.error('[1] nonces() FAILED:', nonceData.error); process.exit(1); }
  const nonce = BigInt(nonceData.result || '0x0');
  console.log('[1] AUSD nonces() for deposit wallet:', nonce.toString());

  // 2. DOMAIN_SEPARATOR
  const domainData = await rpcCall('eth_call', [{ to: AUSD, data: '0x3644e515' }, 'latest']);
  console.log('[2] DOMAIN_SEPARATOR:', domainData.result?.slice(0, 20) + '...');

  // 3. Multicall3 code
  const codeData = await rpcCall('eth_getCode', [MULTICALL3, 'latest']);
  const deployed = codeData.result && codeData.result.length > 4;
  console.log(`[3] Multicall3 deployed: ${deployed ? 'YES' : 'NO'}`);

  // 4. Sign EIP-712 permit with deposit wallet (zero gas)
  const amountWei = BigInt(Math.floor(AMOUNT_USDC * 1_000_000));
  const deadline  = BigInt(Math.floor(Date.now() / 1000) + 3600);

  const typedData = {
    domain:      { name: 'AUSD', version: '1', chainId: CHAIN_ID, verifyingContract: AUSD },
    types:       { Permit: [
      { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' }, { name: 'nonce',   type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ]},
    primaryType: 'Permit',
    message:     {
      owner: depositWalletAddress, spender: TREASURY_ADDR,
      value: amountWei.toString(), nonce: nonce.toString(), deadline: deadline.toString()
    }
  };

  console.log('\n[4] signTypedData_v4 on deposit wallet (zero gas)...');
  const signRes  = await privyRpc(depositWalletId, {
    method: 'eth_signTypedData_v4',
    caip2:  `eip155:${CHAIN_ID}`,
    params: { typedData }
  });
  const signText = await signRes.text();
  console.log('  HTTP status:', signRes.status);

  if (!signRes.ok) {
    console.error('  FAIL:', signText.slice(0, 400));
    console.log('\n  Trying eth_signTypedData (v3 fallback)...');
    const v3Res  = await privyRpc(depositWalletId, {
      method: 'eth_signTypedData', caip2: `eip155:${CHAIN_ID}`, params: { typedData }
    });
    const v3Text = await v3Res.text();
    console.log('  v3 status:', v3Res.status, v3Text.slice(0, 200));
    return;
  }

  const signData  = JSON.parse(signText);
  const signature = signData?.data?.signature || signData?.signature || signData?.result;
  console.log('  OK — signature:', signature?.slice(0, 20) + '...');

  const sig = signature.startsWith('0x') ? signature.slice(2) : signature;
  const r   = sig.slice(0, 64);
  const s   = sig.slice(64, 128);
  const v   = parseInt(sig.slice(128, 130), 16);
  console.log(`  v=${v} r=0x${r.slice(0,8)}... s=0x${s.slice(0,8)}...`);

  if (!WET) {
    console.log('\n  DRY RUN COMPLETE — signing surfaces verified.');
    console.log('  Run with --wet to do a real $0.01 sweep via Multicall3.');
    console.log('\n=== MONAD TEST COMPLETE ===');
    return;
  }

  // WET: broadcast permit + transferFrom via Multicall3
  console.log('\n[5] WET RUN: broadcasting permit+transferFrom via Multicall3...');

  function padAddr(a)  { return a.replace('0x', '').padStart(64, '0'); }
  function padUint(n)  { return BigInt(n).toString(16).padStart(64, '0'); }
  function word(n)     { return BigInt(n).toString(16).padStart(64, '0'); }
  function addrW(a)    { return a.replace('0x', '').padStart(64, '0'); }
  function bytesBlock(hex) {
    const raw    = hex.startsWith('0x') ? hex.slice(2) : hex;
    const padded = raw.length % 64 ? raw + '0'.repeat(64 - raw.length % 64) : raw;
    return padded;
  }

  const permitCalldata = '0xd505accf' +
    padAddr(depositWalletAddress) + padAddr(TREASURY_ADDR) +
    padUint(amountWei) + padUint(deadline) +
    padUint(v) + r.padStart(64, '0') + s.padStart(64, '0');

  const tfCalldata = '0x23b872dd' +
    padAddr(depositWalletAddress) + padAddr(TREASURY_ADDR) + padUint(amountWei);

  const calls = [
    { target: AUSD, bytes: permitCalldata.slice(2) },
    { target: AUSD, bytes: tfCalldata.slice(2) }
  ];
  const offsets = [];
  let off = calls.length * 32;
  for (const c of calls) {
    offsets.push(off);
    off += 3 * 32 + 32 + Math.ceil(c.bytes.length / 64) * 32;
  }
  let enc = word(0x20) + word(calls.length);
  for (const o of offsets) enc += word(o);
  for (const c of calls) {
    enc += addrW(c.target) + word(0) + word(0x60) + word(c.bytes.length / 2) + bytesBlock(c.bytes);
  }
  const multicallData = '0x82ad56cb' + enc;

  const txRes  = await privyRpc(TREASURY_ID, {
    method: 'eth_sendTransaction',
    caip2:  `eip155:${CHAIN_ID}`,
    params: { transaction: { to: MULTICALL3, data: multicallData, value: '0x0' } }
  });
  const txText = await txRes.text();
  console.log('  HTTP status:', txRes.status);
  if (!txRes.ok) {
    console.error('  FAIL:', txText.slice(0, 400));
  } else {
    const txData = JSON.parse(txText);
    const txHash = txData?.data?.hash || txData?.hash || txData?.result;
    console.log('  OK — tx hash:', txHash);
    console.log('  Explorer: https://testnet.monadexplorer.com/tx/' + txHash);
  }

  console.log('\n=== MONAD TEST COMPLETE ===');
}

// ─── DISPATCH ────────────────────────────────────────────────────────────────

try {
  if (chain === 'solana') {
    await testSolana();
  } else if (chain === 'monad') {
    await testMonad();
  } else {
    console.error('Unknown chain:', chain, '— must be solana or monad');
    process.exit(1);
  }
} catch (err) {
  console.error('\nTest failed:', err?.message || err);
  process.exit(1);
}
