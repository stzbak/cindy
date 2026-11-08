import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// Integration: preserve an atomic rollback ref and reject stale expected HEADs.
// Local bare remotes exercise actual Git leases through the production script.
const SCRIPT = fileURLToPath(new URL('../promote-release.mjs', import.meta.url));
function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
for (const scenario of ['promote', 'concurrent-edit', 'stale-direct-build']) {
  test(scenario, () => {
    const root = mkdtempSync(join(tmpdir(), 'cindy-promote-'));
    try {
      const remote = join(root, 'origin.git');
      const repo = join(root, 'work');
      git(root, ['init', '--bare', remote]);
      git(root, ['init', '--initial-branch=personal', repo]);
      git(repo, ['config', 'user.name', 'Personal Test']);
      git(repo, ['config', 'user.email', 'test@example.invalid']);
      git(repo, ['remote', 'add', 'origin', remote]);
      function commit(content) {
        writeFileSync(join(repo, 'app.txt'), content);
        git(repo, ['add', 'app.txt']);
        git(repo, ['commit', '-m', content]);
        return git(repo, ['rev-parse', 'HEAD']);
      }
      const previous = commit('old stable');
      git(repo, ['push', 'origin', 'HEAD:personal']);
      const candidate = commit('verified candidate');
      let expectedRemote = candidate;
      if (scenario !== 'promote') {
        expectedRemote = commit('concurrent owner change');
        git(repo, ['push', 'origin', 'HEAD:personal']);
        git(repo, ['checkout', '--detach', candidate]);
      }
      const result = spawnSync(process.execPath, [SCRIPT], {
        cwd: repo, encoding: 'utf8', env: { ...process.env, GITHUB_SHA: candidate,
          GITHUB_RUN_ID: '123', EXPECTED_PREVIOUS_HEAD: scenario === 'stale-direct-build' ? '' : previous },
      });
      assert.equal(result.status === 0, scenario === 'promote', result.stderr);
      assert.equal(git(repo, ['ls-remote', 'origin', 'refs/heads/personal']).split(/\s+/)[0], expectedRemote);
      const backup = git(repo, ['ls-remote', 'origin', 'refs/heads/automation/personal-backup-123']);
      if (scenario === 'promote') assert.equal(backup.split(/\s+/)[0], previous);
      else assert.equal(backup, '');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}
