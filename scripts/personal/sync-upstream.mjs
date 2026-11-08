#!/usr/bin/env node

// Rebase the Personal commit stack onto the latest upstream branch without
// touching the source branch when the operation conflicts.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_UPSTREAM_URL = 'https://github.com/makecindy/cindy.git';

function parseArgs(argv) {
  const args = {
    upstreamUrl: process.env.PERSONAL_UPSTREAM_URL || DEFAULT_UPSTREAM_URL,
    upstreamBranch: 'main',
    expectedBranch: 'personal',
    allowDirty: false,
    json: false,
    resultFile: '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const readValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(arg + ' requires a value');
      index += 1;
      return value;
    };
    switch (arg) {
      case '--upstream-url': args.upstreamUrl = readValue(); break;
      case '--upstream-branch': args.upstreamBranch = readValue(); break;
      case '--expected-branch': args.expectedBranch = readValue(); break;
      case '--result-file': args.resultFile = readValue(); break;
      case '--allow-dirty': args.allowDirty = true; break;
      case '--json': args.json = true; break;
      case '--help':
        process.stdout.write('Usage: node scripts/personal/sync-upstream.mjs [options]\n\n'
          + '  --upstream-url <url>       Default: ' + DEFAULT_UPSTREAM_URL + '\n'
          + '  --upstream-branch <name>  Default: main\n'
          + '  --expected-branch <name>  Default: personal\n'
          + '  --result-file <path>      Write a machine-readable result\n'
          + '  --allow-dirty             Permit tracked working-tree changes (not recommended)\n'
          + '  --json                    Print the result as JSON\n');
        process.exit(0);
        break;
      default:
        throw new Error('Unknown argument: ' + arg);
    }
  }
  return args;
}

function git(args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });
  if (!allowFailure && result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error('git ' + args.join(' ') + ' failed' + (detail ? ': ' + detail : ''));
  }
  return result;
}

function readText(args) {
  return git(args).stdout.trim();
}

function currentConflicts() {
  const output = git(
    ['diff', '--name-only', '--diff-filter=U', '--', '.'],
    { allowFailure: true },
  ).stdout;
  return [...new Set(output.split(/\r?\n/).map((value) => value.trim()).filter(Boolean))].sort();
}

function writeResult(path, result) {
  if (!path) return;
  const absolutePath = resolve(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, JSON.stringify(result, null, 2) + '\n', 'utf8');
}

function assertRepository({ allowDirty, expectedBranch }) {
  const topLevel = readText(['rev-parse', '--show-toplevel']);
  if (resolve(topLevel) !== resolve(process.cwd())) {
    throw new Error('Run this command from the repository root: ' + topLevel);
  }
  const branch = readText(['branch', '--show-current']);
  if (!branch) throw new Error('Detached HEAD is not supported');
  if (expectedBranch && branch !== expectedBranch) {
    throw new Error('Expected branch ' + expectedBranch + ', found ' + branch);
  }
  if (!allowDirty) {
    const dirty = readText(['status', '--porcelain', '--untracked-files=normal']);
    if (dirty) throw new Error('Working tree must be clean before syncing upstream');
  }
  return branch;
}

export function syncUpstream(options) {
  const startedAt = new Date().toISOString();
  const result = {
    schemaVersion: 1,
    status: 'error',
    branch: '',
    upstreamUrl: options.upstreamUrl,
    upstreamBranch: options.upstreamBranch,
    upstreamSha: '',
    previousHead: '',
    currentHead: '',
    commitsReplayed: 0,
    conflictFiles: [],
    message: '',
    startedAt,
    finishedAt: '',
  };

  try {
    result.branch = assertRepository(options);
    result.previousHead = readText(['rev-parse', 'HEAD']);

    const fetched = git(
      ['fetch', '--no-tags', options.upstreamUrl, options.upstreamBranch],
      { allowFailure: true },
    );
    if (fetched.status !== 0) {
      result.status = 'fetch-failed';
      result.message = (fetched.stderr || fetched.stdout || 'git fetch failed').trim();
      return result;
    }

    result.upstreamSha = readText(['rev-parse', 'FETCH_HEAD']);
    const alreadyIncluded = git(
      ['merge-base', '--is-ancestor', result.upstreamSha, 'HEAD'],
      { allowFailure: true },
    );
    if (alreadyIncluded.status === 0) {
      result.status = 'up-to-date';
      result.currentHead = result.previousHead;
      return result;
    }

    const rebase = git(['rebase', result.upstreamSha], { allowFailure: true });
    if (rebase.status !== 0) {
      result.conflictFiles = currentConflicts();
      git(['rebase', '--abort'], { allowFailure: true });
      result.status = result.conflictFiles.length > 0 ? 'conflict' : 'rebase-failed';
      result.currentHead = readText(['rev-parse', 'HEAD']);
      result.message = (rebase.stderr || rebase.stdout || 'git rebase failed').trim();
      return result;
    }

    result.status = 'rebased';
    result.currentHead = readText(['rev-parse', 'HEAD']);
    result.commitsReplayed = Number(readText([
      'rev-list', '--count', result.upstreamSha + '..HEAD',
    ]));
    return result;
  } catch (error) {
    result.status = 'error';
    result.message = error instanceof Error ? error.message : String(error);
    return result;
  } finally {
    result.finishedAt = new Date().toISOString();
    writeResult(options.resultFile, result);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = syncUpstream(args);
  if (args.json) {
    process.stdout.write(JSON.stringify(result) + '\n');
  } else {
    const prefix = result.status === 'rebased'
      ? 'Rebased ' + args.expectedBranch + ' onto ' + result.upstreamSha.slice(0, 12)
      : result.status === 'up-to-date'
        ? 'Already current with ' + result.upstreamSha.slice(0, 12)
        : 'Upstream sync failed: ' + result.status;
    process.stdout.write(prefix + '\n');
    if (result.conflictFiles.length > 0) {
      process.stdout.write('Conflicts:\n' + result.conflictFiles.map((file) => '  - ' + file).join('\n') + '\n');
    } else if (result.message && result.status !== 'rebased' && result.status !== 'up-to-date') {
      process.stdout.write(result.message + '\n');
    }
  }

  if (result.status === 'conflict') process.exitCode = 2;
  else if (result.status !== 'rebased' && result.status !== 'up-to-date') process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
    process.exitCode = 1;
  });
}
