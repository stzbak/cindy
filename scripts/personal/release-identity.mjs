import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const endpoints = JSON.parse(fs.readFileSync('config/endpoint.json', 'utf8'));
async function read(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error('Official version lookup failed: HTTP ' + response.status);
  return response.json();
}
const [desktop, android] = await Promise.all([
  read(endpoints.cdnBaseUrl + '/manifest-win32-x64.json'),
  read(endpoints.mobileUpdateBaseUrl + '/latest?platform=android'),
]);
for (const version of [desktop.app?.version, android.version]) {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid official release version');
}
const buildNumber = 200000 + Number(process.env.GITHUB_RUN_NUMBER);
if (!Number.isSafeInteger(buildNumber) || buildNumber <= 200000 || buildNumber > 2100000000) throw new Error('Invalid Personal build sequence');
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (sourceCommit !== process.env.GITHUB_SHA) throw new Error('Release source mismatch');
// Skip a weekly build only when the complete latest release has the same source
// and both official platform versions. A lookup failure stops instead of hiding it.
let needed = true;
if (process.env.GH_TOKEN) {
  const latest = JSON.parse(execFileSync('gh', ['api', 'repos/stzbak/cindy/releases/latest'], { encoding: 'utf8' }));
  const asset = latest.assets?.find(asset => asset.name === 'release-identity.json');
  if (asset) {
    const previous = await read(asset.browser_download_url);
    needed = previous.sourceCommit !== sourceCommit || previous.desktopVersion !== desktop.app.version || previous.androidVersion !== android.version;
  }
}
const identity = {
  desktopVersion: desktop.app.version, androidVersion: android.version,
  buildNumber, sourceCommit, needed,
  tag: 'personal-win-' + desktop.app.version + '-android-' + android.version + '-r' + process.env.GITHUB_RUN_NUMBER,
};
const dir = path.join(process.env.RUNNER_TEMP, 'personal-release-identity');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'release-identity.json'), JSON.stringify(identity, null, 2) + '\n');
fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(identity).map(([key, value]) => key + '=' + value).join('\n') + '\n');
console.log(JSON.stringify(identity));
