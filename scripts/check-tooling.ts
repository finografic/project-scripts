#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { exit } from 'node:process';

function fail(message: string): never {
  console.error(`\n❌ ${message}\n`);
  exit(1);
}

function run(cmd: string): string {
  try {
    return execSync(cmd, { stdio: 'pipe' }).toString().trim();
  } catch {
    fail(`Failed to run: ${cmd}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Node version                                                                */
/* -------------------------------------------------------------------------- */

const nodeMajor = Number(process.versions.node.split('.')[0]);

if (nodeMajor !== 22 && nodeMajor !== 24) {
  fail(
    `Unsupported Node.js version ${process.versions.node}\n`
      + 'Expected Node 22 or 24',
  );
}

/* -------------------------------------------------------------------------- */
/* pnpm via Corepack                                                           */
/* -------------------------------------------------------------------------- */

const pnpmPath = run('which pnpm');

if (!pnpmPath.includes('node')) {
  fail(
    'pnpm does not appear to be managed by Corepack.\n'
      + `Found pnpm at: ${pnpmPath}\n\n`
      + 'Fix:\n'
      + '  corepack enable\n'
      + '  corepack prepare pnpm@10.28.1 --activate',
  );
}

/* -------------------------------------------------------------------------- */
/* pnpm version matches packageManager                                         */
/* -------------------------------------------------------------------------- */

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

if (!pkg.packageManager?.startsWith('pnpm@')) {
  fail('package.json is missing a pnpm packageManager entry');
}

const expectedVersion = pkg.packageManager.split('@')[1].split('+')[0];
const actualVersion = run('pnpm --version');

if (actualVersion !== expectedVersion) {
  fail(
    'pnpm version mismatch\n\n'
      + `Expected: ${expectedVersion}\n`
      + `Found:    ${actualVersion}\n\n`
      + 'Fix:\n'
      + `  corepack prepare pnpm@${expectedVersion} --activate`,
  );
}

/* -------------------------------------------------------------------------- */
/* Success                                                                     */
/* -------------------------------------------------------------------------- */

console.log('✅ Tooling check passed');
