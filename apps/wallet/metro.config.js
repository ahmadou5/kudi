const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Ensure Metro watches all files across the monorepo root
config.watchFolders = Array.from(new Set([...(config.watchFolders || []), monorepoRoot]));

// Configure node_modules resolution paths for monorepo
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Prefer browser/react-native build fields so packages like `jose` don't load Node-specific runtime modules
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Mapping Node builtins to browser polyfill package names
const moduleAliases = {
  http: 'stream-http',
  https: 'https-browserify',
  crypto: 'expo-crypto',
  util: 'util',
  buffer: 'buffer',
  process: 'process',
  stream: 'stream-browserify',
  events: 'events',
  path: 'path-browserify',
  zlib: 'browserify-zlib',
  assert: 'assert',
};

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  http: path.resolve(monorepoRoot, 'node_modules/stream-http'),
  https: path.resolve(monorepoRoot, 'node_modules/https-browserify'),
  crypto: path.resolve(monorepoRoot, 'node_modules/expo-crypto'),
  util: path.resolve(monorepoRoot, 'node_modules/util'),
  buffer: path.resolve(monorepoRoot, 'node_modules/buffer'),
  process: path.resolve(monorepoRoot, 'node_modules/process'),
  stream: path.resolve(monorepoRoot, 'node_modules/stream-browserify'),
  events: path.resolve(monorepoRoot, 'node_modules/events'),
  path: path.resolve(monorepoRoot, 'node_modules/path-browserify'),
  zlib: path.resolve(monorepoRoot, 'node_modules/browserify-zlib'),
  assert: path.resolve(monorepoRoot, 'node_modules/assert'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'jose') {
    return {
      filePath: path.resolve(
        monorepoRoot,
        'node_modules/.pnpm/jose@4.15.9/node_modules/jose/dist/browser/index.js'
      ),
      type: 'sourceFile',
    };
  }
  if (moduleName === 'crypto') {
    return {
      filePath: path.resolve(projectRoot, 'lib/crypto-shim.js'),
      type: 'sourceFile',
    };
  }
  if (moduleAliases[moduleName]) {
    return context.resolveRequest(context, moduleAliases[moduleName], platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
