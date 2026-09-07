import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Buffer } from 'buffer';
import * as ExpoCrypto from 'expo-crypto';

// Polyfill global Buffer
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}
if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}

// Polyfill global crypto
const g = typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : window;

if (!g.crypto) {
  (g as any).crypto = {};
}

if (!g.crypto.getRandomValues) {
  (g.crypto as any).getRandomValues = (array: any) => ExpoCrypto.getRandomValues(array);
}

if (!g.crypto.randomUUID && ExpoCrypto.randomUUID) {
  (g.crypto as any).randomUUID = () => ExpoCrypto.randomUUID();
}

if (typeof global !== 'undefined' && !(global as any).crypto) {
  (global as any).crypto = g.crypto;
}
