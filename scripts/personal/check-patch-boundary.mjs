#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

function parseBase(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--base') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--base requires a commit or ref');
      return value;
    }
  }
  return process.env.PERSONAL_UPSTREAM_SHA || '';
}

function git(args) {
  const result = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf8' });
  if (result.status !== 0) throw new Error((result.stderr || result.stdout || 'git failed').trim());
  return result.stdout.trim();
}

const protectedPaths = [
  { pattern: /^pnpm-lock\.yaml$/, reason: 'dependency lockfile' },
  { pattern: /^\.github\/workflows\/ci\.yml$/, reason: 'upstream CI workflow' },
  { pattern: /^config\/endpoint(?:\.global|\.dev)?\.json$/, reason: 'service endpoint configuration' },
  { pattern: /^apps\/desktop\/drizzle\//, reason: 'database migrations' },
  { pattern: /^apps\/desktop\/cindy-updater\//, reason: 'updater implementation' },
  { pattern: /^apps\/desktop\/forge\.config\.ts$/, reason: 'desktop packaging and signing' },
  { pattern: /^apps\/desktop\/src\/main\/localDb\//, reason: 'database implementation' },
  { pattern: /^apps\/desktop\/src\/main\/update/, reason: 'desktop update implementation' },
  { pattern: /^apps\/mobile\/(?:android|ios)\//, reason: 'generated native project' },
  { pattern: /^apps\/mobile\/src\/update\//, reason: 'mobile update implementation' },
  { pattern: /^apps\/mobile\/scripts\/(?:build-android|build-ios|release-lib)\.mjs$/, reason: 'mobile release and signing tooling' },
  { pattern: /^apps\/mobile\/scripts\/self-host-regions\.json$/, reason: 'local signing configuration' },
  { pattern: /\.(?:jks|keystore|p12|pfx)$/i, reason: 'signing material' },
  { pattern: /^packages\/(?!lizi-mcps\/)/, reason: 'shared protocol or runtime package' },
];

const base = parseBase(process.argv.slice(2));
if (!base) {
  process.stdout.write('[personal-boundary] skipped: pass --base or set PERSONAL_UPSTREAM_SHA\n');
  process.exit(0);
}

git(['rev-parse', '--verify', base + '^{commit}']);
const files = git(['diff', '--name-only', base + '...HEAD'])
  .split(/\r?\n/)
  .map((file) => file.trim())
  .filter(Boolean);
const violations = [];
for (const file of files) {
  for (const entry of protectedPaths) {
    if (entry.pattern.test(file)) violations.push({ file, reason: entry.reason });
  }
}

if (violations.length > 0) {
  process.stderr.write('[personal-boundary] protected paths changed:\n');
  for (const violation of violations) {
    process.stderr.write('  - ' + violation.file + ': ' + violation.reason + '\n');
  }
  process.exit(1);
}

process.stdout.write('[personal-boundary] PASS (' + files.length + ' changed files)\n');
