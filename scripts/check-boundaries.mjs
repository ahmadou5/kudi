import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const ignoredDirs = new Set(['node_modules', 'dist', '.next', '.turbo', '.expo', '.git']);

const frontendAppRoots = ['apps/wallet', 'apps/web', 'apps/admin'];
const frontendForbiddenPackages = [
  '@kudi/database',
  '@kudi/chains',
  '@kudi/payment-providers',
  '@kudi/kyc',
  '@kudi/config',
  '@kudi/cards',
  '@kudi/receipts'
];

const packageRoots = ['packages'];
const walletForbiddenPackages = ['@kudi/ui'];

const violations = [];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (ignoredDirs.has(entry)) continue;
    const absolute = join(dir, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      walk(absolute, files);
      continue;
    }
    const extension = absolute.slice(absolute.lastIndexOf('.'));
    if (sourceExtensions.has(extension)) {
      files.push(absolute);
    }
  }
  return files;
}

function importsFrom(source) {
  const imports = [];
  const patterns = [
    /import\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /export\s+(?:type\s+)?[^'";]+?\s+from\s+['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) {
      imports.push(match[1]);
    }
  }
  return imports;
}

function checkFile(file) {
  const rel = relative(repoRoot, file);
  const source = readFileSync(file, 'utf8');
  const specifiers = importsFrom(source);

  if (frontendAppRoots.some((root) => rel.startsWith(`${root}/`))) {
    for (const specifier of specifiers) {
      const forbidden = frontendForbiddenPackages.find((pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`));
      if (forbidden) {
        violations.push(`${rel}: frontend code must not import Node/server-only package ${forbidden}`);
      }
    }
  }

  if (rel.startsWith('apps/wallet/')) {
    for (const specifier of specifiers) {
      const forbidden = walletForbiddenPackages.find((pkg) => specifier === pkg || specifier.startsWith(`${pkg}/`));
      if (forbidden) {
        violations.push(`${rel}: native wallet code must not import web-only package ${forbidden}`);
      }
    }
  }

  if (packageRoots.some((root) => rel.startsWith(`${root}/`))) {
    for (const specifier of specifiers) {
      if (specifier.startsWith('../../apps/') || specifier.startsWith('../apps/') || specifier.startsWith('apps/')) {
        violations.push(`${rel}: packages must not import app code (${specifier})`);
      }
    }
  }
}

for (const root of ['apps', 'packages']) {
  for (const file of walk(join(repoRoot, root))) {
    checkFile(file);
  }
}

if (violations.length > 0) {
  console.error('Architecture boundary violations found:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('Architecture boundaries passed');
