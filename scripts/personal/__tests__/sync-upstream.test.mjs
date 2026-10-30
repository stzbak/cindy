import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../sync-upstream.mjs', import.meta.url));

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function git(args, cwd) {
  return run('git', args, cwd);
}

function initializeRepository(root) {
  const upstream = join(root, 'upstream.git');
  const repo = join(root, 'repo');
  run('git', ['init', '--bare', '--initial-branch=main', upstream], root);
  run('git', ['init', '--initial-branch=personal', repo], root);
  git(['config', 'user.name', 'Personal Test'], repo);
  git(['config', 'user.email', 'personal-test@example.invalid'], repo);
  return { upstream, repo };
}

function commitFile(repo, file, content, message) {
  writeFileSync(join(repo, file), content, 'utf8');
  git(['add', file], repo);
  git(['commit', '-m', message], repo);
  return git(['rev-parse', 'HEAD'], repo);
}

function seedMain(repo, upstream) {
  const base = commitFile(repo, 'shared.txt', 'base\n', 'base');
  git(['push', upstream, 'HEAD:main'], repo);
  return base;
}

function createUpstreamCommit(repo, upstream, base, file, content, message) {
  const branch = 'upstream-' + Date.now();
  git(['switch', '-c', branch, base], repo);
  commitFile(repo, file, content, message);
  git(['push', upstream, 'HEAD:main'], repo);
  git(['switch', 'personal'], repo);
}

function sync(repo, upstream, resultFile) {
  return spawnSync(
    process.execPath,
    [SCRIPT, '--upstream-url', upstream, '--result-file', resultFile, '--json'],
    { cwd: repo, encoding: 'utf8' },
  );
}

test('rebases the Personal commit stack onto a newer upstream main', () => {
  const root = mkdtempSync(join(tmpdir(), 'cindy-personal-sync-'));
  try {
    const { upstream, repo } = initializeRepository(root);
    const base = seedMain(repo, upstream);
    commitFile(repo, 'personal.txt', 'personal\n', 'personal profile');
    createUpstreamCommit(repo, upstream, base, 'upstream.txt', 'upstream\n', 'upstream change');

    const resultFile = join(root, 'result.json');
    const result = sync(repo, upstream, resultFile);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(readFileSync(resultFile, 'utf8'));
    assert.equal(summary.status, 'rebased');
    assert.equal(summary.conflictFiles.length, 0);
    assert.equal(readFileSync(join(repo, 'personal.txt'), 'utf8'), 'personal\n');
    assert.equal(readFileSync(join(repo, 'upstream.txt'), 'utf8'), 'upstream\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('aborts a conflicting rebase and reports conflicted files', () => {
  const root = mkdtempSync(join(tmpdir(), 'cindy-personal-conflict-'));
  try {
    const { upstream, repo } = initializeRepository(root);
    const base = seedMain(repo, upstream);
    commitFile(repo, 'shared.txt', 'personal\n', 'personal change');
    createUpstreamCommit(repo, upstream, base, 'shared.txt', 'upstream\n', 'upstream change');

    const before = git(['rev-parse', 'HEAD'], repo);
    const resultFile = join(root, 'result.json');
    const result = sync(repo, upstream, resultFile);
    assert.equal(result.status, 2, result.stderr || result.stdout);
    const summary = JSON.parse(readFileSync(resultFile, 'utf8'));
    assert.equal(summary.status, 'conflict');
    assert.deepEqual(summary.conflictFiles, ['shared.txt']);
    assert.equal(git(['rev-parse', 'HEAD'], repo), before);
    assert.equal(git(['status', '--porcelain'], repo), '');
    assert.equal(readFileSync(join(repo, 'shared.txt'), 'utf8'), 'personal\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reports an up-to-date Personal branch without changing HEAD', () => {
  const root = mkdtempSync(join(tmpdir(), 'cindy-personal-current-'));
  try {
    const { upstream, repo } = initializeRepository(root);
    seedMain(repo, upstream);
    commitFile(repo, 'personal.txt', 'personal\n', 'personal profile');
    git(['push', upstream, 'HEAD:main'], repo);

    const before = git(['rev-parse', 'HEAD'], repo);
    const resultFile = join(root, 'result.json');
    const result = sync(repo, upstream, resultFile);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(readFileSync(resultFile, 'utf8'));
    assert.equal(summary.status, 'up-to-date');
    assert.equal(git(['rev-parse', 'HEAD'], repo), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('refuses to mutate a dirty working tree', () => {
  const root = mkdtempSync(join(tmpdir(), 'cindy-personal-dirty-'));
  try {
    const { upstream, repo } = initializeRepository(root);
    seedMain(repo, upstream);
    writeFileSync(join(repo, 'dirty.txt'), 'dirty\n', 'utf8');

    const before = git(['rev-parse', 'HEAD'], repo);
    const resultFile = join(root, 'result.json');
    const result = sync(repo, upstream, resultFile);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const summary = JSON.parse(readFileSync(resultFile, 'utf8'));
    assert.equal(summary.status, 'error');
    assert.match(summary.message, /Working tree must be clean/);
    assert.equal(git(['rev-parse', 'HEAD'], repo), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
