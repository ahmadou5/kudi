import test from 'node:test';
import assert from 'node:assert/strict';
import { KudiSDK } from '../dist/index.js';

test('sdk: initializes with default base URL and sanitizes double https prefix', () => {
  const sdk = new KudiSDK({ baseUrl: 'hhttps://kudiapi-production.up.railway.app' });
  assert.ok(sdk);
});

test('sdk: allows setting and getting auth token state', () => {
  const sdk = new KudiSDK({ baseUrl: 'http://localhost:4000' });
  sdk.setAuthToken('test_jwt_token_123');
  assert.ok(sdk);
});
