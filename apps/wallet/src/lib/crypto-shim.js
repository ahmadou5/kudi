import 'react-native-get-random-values';
import * as ExpoCrypto from 'expo-crypto';

export const getRandomValues = function getRandomValues(array) {
  return ExpoCrypto.getRandomValues(array);
};

export const randomUUID = function randomUUID() {
  if (ExpoCrypto.randomUUID) {
    return ExpoCrypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const randomBytes = function randomBytes(size) {
  const bytes = new Uint8Array(size);
  ExpoCrypto.getRandomValues(bytes);
  return bytes;
};

export const subtle = (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) || {};

const cryptoObj = {
  getRandomValues,
  randomUUID,
  randomBytes,
  subtle,
};

export const crypto = typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : cryptoObj;

export default {
  getRandomValues,
  randomUUID,
  randomBytes,
  subtle,
  crypto,
};
