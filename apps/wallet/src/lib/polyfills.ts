import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Buffer } from 'buffer';
import * as ExpoCrypto from 'expo-crypto';

// Polyfill global Buffer
if (typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}

// Polyfill global crypto
const g: any = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {};

if (!g.crypto) {
  g.crypto = {};
}

if (!g.crypto.getRandomValues) {
  g.crypto.getRandomValues = (array: any) => ExpoCrypto.getRandomValues(array);
}

if (!g.crypto.randomUUID && ExpoCrypto.randomUUID) {
  g.crypto.randomUUID = () => ExpoCrypto.randomUUID();
}
