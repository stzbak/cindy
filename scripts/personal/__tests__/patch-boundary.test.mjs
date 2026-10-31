import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../check-patch-boundary.mjs', import.meta.url));

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: 'utf8' });
}

function git(args, cwd) {
  const result = run('git', args, cwd);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function write(repo, file, content) {
  mkdirSync(dirname(join(repo, file)), { recursive: true });
  writeFileSync(join(repo, file), content, 'utf8');
  git(['add', file], repo);
}

function initializeRepository() {
  const repo = mkdtempSync(join(tmpdir(), 'cindy-personal-boundary-'));
  git(['init', '--initial-branch=personal'], repo);
  git(['config', 'user.name', 'Personal Test'], repo);
  git(['config', 'user.email', 'personal-test@example.invalid'], repo);
  write(repo, 'README.md', 'base\n');
  git(['commit', '-m', 'base'], repo);
  return repo;
}

test('allows the Personal gate layer and its documentation', () => {
  const repo = initializeRepository();
  try {
    const base = git(['rev-parse', 'HEAD'], repo);
    write(repo, 'apps/mobile/src/config/personalProfile.ts', 'export const enabled = false;\n');
    write(repo, 'docs/personal-fork/README.md', 'personal profile\n');
    git(['commit', '-m', 'personal gate'], repo);

    const result = run(process.execPath, [SCRIPT, '--base', base], repo);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /PASS/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('allows only the reviewed Personal updater deltas', () => {
  const repo = initializeRepository();
  try {
    const base = git(['rev-parse', 'HEAD'], repo);
    write(repo, 'apps/mobile/src/update/fetchPersonalLatestRelease.ts', 'export const feed = true;\n');
    write(repo, 'apps/desktop/src/main/updateService.ts', 'export const personalFeed = true;\n');
    git(['commit', '-m', 'personal updater'], repo);
    const allowed = run(process.execPath, [SCRIPT, '--base', base], repo);
    assert.equal(allowed.status, 0, allowed.stderr || allowed.stdout);

    const nextBase = git(['rev-parse', 'HEAD'], repo);
    write(repo, 'apps/mobile/src/update/unreviewedUpdater.ts', 'export const unsafe = true;\n');
    git(['commit', '-m', 'unreviewed updater'], repo);
    const rejected = run(process.execPath, [SCRIPT, '--base', nextBase], repo);
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /unreviewedUpdater\.ts/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('rejects protected persistence, signing, endpoint, and dependency changes', () => {
  const repo = initializeRepository();
  try {
    const base = git(['rev-parse', 'HEAD'], repo);
    write(repo, 'apps/desktop/drizzle/9999_unsafe.sql', 'DROP TABLE sessions;\n');
    write(repo, 'config/endpoint.json', '{}\n');
    write(repo, 'pnpm-lock.yaml', 'unsafe: true\n');
    git(['commit', '-m', 'unsafe boundary'], repo);

    const result = run(process.execPath, [SCRIPT, '--base', base], repo);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /apps\/desktop\/drizzle\/9999_unsafe\.sql/);
    assert.match(result.stderr, /config\/endpoint\.json/);
    assert.match(result.stderr, /pnpm-lock\.yaml/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('is a no-op when no upstream base is supplied', () => {
  const repo = initializeRepository();
  try {
    const result = spawnSync(process.execPath, [SCRIPT], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, PERSONAL_UPSTREAM_SHA: '' },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /skipped/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
