import test from 'node:test';
import assert from 'node:assert/strict';

const SOLANA_TREASURY = 'KudiTreasurySolanaDevnet11111111111111111111';
const EVM_TREASURY = '0xKudiTreasuryMonadMetropolisTestnet000';

function resolveTreasuryAddress(chain) {
  return chain === 'monad' ? EVM_TREASURY : SOLANA_TREASURY;
}

function processSweep({ walletAddress, privyWalletId, amountUSDC, chain }) {
  const targetTreasury = resolveTreasuryAddress(chain);

  if (!privyWalletId) {
    return {
      success: false,
      mode: 'FLOAT_MODEL',
      reason: 'SELF_CUSTODY_FLOAT_MODEL: Keys user-held. Float model credits ledger.',
      targetTreasury
    };
  }

  if (walletAddress === targetTreasury) {
    return { success: true, mode: 'NO_OP', targetTreasury };
  }

  return {
    success: true,
    mode: 'ON_CHAIN_SWEEP',
    txHash: '0xsweep_' + Math.random().toString(36).substring(2, 10),
    targetTreasury
  };
}

test('sweep: correctly routes Monad AUSD and Solana USDC to respective treasury addresses', () => {
  assert.equal(resolveTreasuryAddress('monad'), EVM_TREASURY);
  assert.equal(resolveTreasuryAddress('solana'), SOLANA_TREASURY);
});

test('sweep: applies Track A float model for self-custody wallets without failing deposit ledger credit', () => {
  const result = processSweep({
    walletAddress: '0xUserSelfCustodyAddress123',
    privyWalletId: undefined, // Track A: embedded wallet
    amountUSDC: 100,
    chain: 'monad'
  });

  assert.equal(result.success, false);
  assert.equal(result.mode, 'FLOAT_MODEL');
  assert.equal(result.targetTreasury, EVM_TREASURY);
});

test('sweep: executes on-chain sweep transfer for server-custody wallets (Track B)', () => {
  const result = processSweep({
    walletAddress: '0xUserServerWallet456',
    privyWalletId: 'wallet_privy_server_789',
    amountUSDC: 50,
    chain: 'monad'
  });

  assert.equal(result.success, true);
  assert.equal(result.mode, 'ON_CHAIN_SWEEP');
  assert.ok(result.txHash.startsWith('0xsweep_'));
});

test('sweep: handles idempotency when wallet address is already treasury', () => {
  const result = processSweep({
    walletAddress: EVM_TREASURY,
    privyWalletId: 'wallet_treasury_000',
    amountUSDC: 50,
    chain: 'monad'
  });

  assert.equal(result.success, true);
  assert.equal(result.mode, 'NO_OP');
});

function validateSweepConfigPayload(body, previous = { mode: 'AUTO', gasPaymentMode: 'TREASURY_FEE_PAYER' }) {
  const validModes = ['AUTO', 'SPONSORED'];
  const validGasPaymentModes = ['TREASURY_FEE_PAYER'];

  if (!body?.mode || !validModes.includes(body.mode)) {
    throw new Error(`Field "mode" must be one of: ${validModes.join(', ')}`);
  }

  let gasPaymentMode = 'TREASURY_FEE_PAYER';
  if (body.gasPaymentMode !== undefined) {
    if (!validGasPaymentModes.includes(body.gasPaymentMode)) {
      throw new Error(`Field "gasPaymentMode" must be one of: ${validGasPaymentModes.join(', ')}`);
    }
    gasPaymentMode = body.gasPaymentMode;
  } else if (validGasPaymentModes.includes(previous.gasPaymentMode)) {
    gasPaymentMode = previous.gasPaymentMode;
  }

  return {
    mode: body.mode,
    gasPaymentMode
  };
}

test('sweep gas policy: strictly enforces TREASURY_FEE_PAYER and rejects PRIVY_SPONSOR', () => {
  // Valid TREASURY_FEE_PAYER succeeds
  const valid = validateSweepConfigPayload({ mode: 'AUTO', gasPaymentMode: 'TREASURY_FEE_PAYER' });
  assert.equal(valid.gasPaymentMode, 'TREASURY_FEE_PAYER');

  // PRIVY_SPONSOR is rejected with clear message
  assert.throws(
    () => validateSweepConfigPayload({ mode: 'AUTO', gasPaymentMode: 'PRIVY_SPONSOR' }),
    { message: /Field "gasPaymentMode" must be one of: TREASURY_FEE_PAYER/ }
  );

  // Invalid gasPaymentMode is rejected
  assert.throws(
    () => validateSweepConfigPayload({ mode: 'AUTO', gasPaymentMode: 'INVALID_MODE' }),
    { message: /Field "gasPaymentMode" must be one of: TREASURY_FEE_PAYER/ }
  );

  // Omitted gasPaymentMode preserves previous valid mode and never yields undefined
  const preserved = validateSweepConfigPayload({ mode: 'SPONSORED' }, { mode: 'AUTO', gasPaymentMode: 'TREASURY_FEE_PAYER' });
  assert.equal(preserved.gasPaymentMode, 'TREASURY_FEE_PAYER');
  assert.notEqual(preserved.gasPaymentMode, undefined);
});

test('sweep gas policy: resolves effective gas payment mode with TREASURY_FEE_PAYER required', async () => {
  const { resolveGasPaymentMode } = await import('../../../packages/chains/dist/index.mjs');
  assert.equal(resolveGasPaymentMode('TREASURY_FEE_PAYER'), 'TREASURY_FEE_PAYER');
  assert.throws(
    () => resolveGasPaymentMode(undefined),
    { message: /GAS_PAYMENT_MODE must be explicitly set to "TREASURY_FEE_PAYER"/ }
  );
  assert.throws(
    () => resolveGasPaymentMode('PRIVY_SPONSOR'),
    { message: /GAS_PAYMENT_MODE must be explicitly set to "TREASURY_FEE_PAYER"/ }
  );
  assert.throws(
    () => resolveGasPaymentMode('unknown_mode'),
    { message: /GAS_PAYMENT_MODE must be explicitly set to "TREASURY_FEE_PAYER"/ }
  );
});

