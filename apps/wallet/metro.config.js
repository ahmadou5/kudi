const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Prefer browser/react-native build fields so packages like `jose` don't load Node-specific runtime modules
config.resolver.resolverMainFields = ['sbmodern', 'react-native', 'browser', 'main'];

// Configure polyfills for Node standard library modules (util, crypto, zlib, buffer, etc.)
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve('expo-crypto'),
  util: require.resolve('util'),
  buffer: require.resolve('buffer'),
  process: require.resolve('process'),
  stream: require.resolve('stream-browserify'),
  events: require.resolve('events'),
  path: require.resolve('path-browserify'),
  zlib: require.resolve('browserify-zlib'),
};

module.exports = config;
