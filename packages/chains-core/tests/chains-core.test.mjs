import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSolanaAddress, validateEVMAddress, validateCryptoAddress } from '../dist/index.js';

test('chains-core: validates Solana addresses accurately', () => {
  const validSolana = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
  const invalidSolana = '0x1234567890123456789012345678901234567890';
  
  assert.equal(validateSolanaAddress(validSolana), true);
  assert.equal(validateSolanaAddress(invalidSolana), false);
  assert.equal(validateSolanaAddress(''), false);
});

test('chains-core: validates EVM / Monad addresses accurately', () => {
  const validEVM = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
  const invalidEVM = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
  
  assert.equal(validateEVMAddress(validEVM), true);
  assert.equal(validateEVMAddress(invalidEVM), false);
  assert.equal(validateCryptoAddress(validEVM, 'monad'), true);
  assert.equal(validateCryptoAddress(validEVM, 'ethereum'), true);
});
