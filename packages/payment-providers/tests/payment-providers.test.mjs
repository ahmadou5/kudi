import test from 'node:test';
import assert from 'node:assert/strict';
import { PaymentProviderRegistry } from '../dist/index.js';
import { PaymentProviderId } from '@kudi/types';

test('payment-providers: registry initializes with default active provider (Bachs)', () => {
  const registry = new PaymentProviderRegistry();
  assert.equal(registry.getActiveProviderId(), PaymentProviderId.BACHS);
  assert.ok(registry.getActiveProvider());
});

test('payment-providers: switcher changes active provider and validates invalid id', () => {
  const registry = new PaymentProviderRegistry();
  registry.setActiveProvider('monnify');
  assert.equal(registry.getActiveProviderId(), PaymentProviderId.MONNIFY);

  registry.setActiveProvider('squad');
  assert.equal(registry.getActiveProviderId(), PaymentProviderId.SQUAD);

  registry.setActiveProvider('bachs');
  assert.equal(registry.getActiveProviderId(), PaymentProviderId.BACHS);

  assert.throws(() => {
    registry.setActiveProvider('non_existent_provider');
  }, /unregistered id/);
});

test('payment-providers: failover order configuration works', () => {
  const registry = new PaymentProviderRegistry();
  const customOrder = [PaymentProviderId.SQUAD, PaymentProviderId.MONNIFY, PaymentProviderId.BACHS];
  registry.setFailoverOrder(customOrder);
  assert.deepEqual(registry.getFailoverOrder(), customOrder);
});
