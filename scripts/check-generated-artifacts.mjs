import { execFileSync } from 'node:child_process';

const generatedPattern = /(^|\/)(node_modules|dist|\.next|\.turbo|\.expo)(\/|$)/;
const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((file) => generatedPattern.test(file));

if (tracked.length > 0) {
  console.error('Tracked generated artifacts found:');
  for (const file of tracked) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log('No tracked generated artifacts found');
