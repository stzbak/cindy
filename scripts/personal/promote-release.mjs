import { execFileSync } from 'node:child_process';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}
const source = git(['rev-parse', 'HEAD']);
if (source !== process.env.GITHUB_SHA) throw new Error('Release source mismatch');
const previous = process.env.EXPECTED_PREVIOUS_HEAD;
if (previous) {
  if (!/^[a-f0-9]{40}$/.test(previous) || !/^\d+$/.test(process.env.GITHUB_RUN_ID || '')) {
    throw new Error('Invalid promotion identity');
  }
  git(['cat-file', '-e', previous + '^{commit}']);
  // Atomic backup + exact lease: concurrent owner edits cannot be overwritten.
  const backup = 'refs/heads/automation/personal-backup-' + process.env.GITHUB_RUN_ID;
  git(['push', '--atomic', '--force-with-lease=refs/heads/personal:' + previous,
    '--force-with-lease=' + backup + ':', 'origin', previous + ':' + backup, source + ':refs/heads/personal']);
} else {
  const remote = git(['ls-remote', 'origin', 'refs/heads/personal']).split(/\s+/)[0];
  if (remote !== source) throw new Error('Personal changed during build; refusing stale release');
}
console.log('Verified release source: ' + source);
