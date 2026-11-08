// CI-only: fetch pinned official assets through GitHub's asset API when release
// web downloads fail. Never change pins or accept unchecked bytes.
import { execFileSync, spawn } from 'node:child_process';
import http from 'node:http';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function api(route, binary = false) {
  return execFileSync('gh', ['api', route, ...(binary ? ['-H', 'Accept: application/octet-stream'] : [])],
    { encoding: binary ? undefined : 'utf8', maxBuffer: 200 * 1024 * 1024, timeout: 180_000 });
}
function release(repo, tag) {
  const meta = JSON.parse(api('repos/' + repo + '/releases/tags/' + encodeURIComponent(tag)));
  if (meta.draft || meta.prerelease || meta.tag_name !== tag) throw new Error('Unexpected tool release identity');
  return meta;
}
function asset(meta, name) {
  const found = meta.assets.find(a => a.name === name);
  if (!Number.isSafeInteger(found?.id)) throw new Error('Missing official asset: ' + name);
  return found;
}
export function verifyAsset(bytes, expected, digest) {
  if (!/^[a-f0-9]{64}$/.test(expected) || digest !== 'sha256:' + expected ||
      createHash('sha256').update(bytes).digest('hex') !== expected) {
    throw new Error('Official asset SHA256 mismatch or missing digest');
  }
}
function download(repo, entry, expected, dest) {
  const bytes = api('repos/' + repo + '/releases/assets/' + entry.id, true);
  verifyAsset(bytes, expected, entry.digest);
  if (bytes.length !== entry.size) throw new Error('Official asset size mismatch');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, bytes);
  console.log('Verified official asset: ' + entry.name);
  return bytes;
}
function publicText(url) {
  return execFileSync('curl', ['--fail', '--location', '--silent', '--show-error',
    '--max-time', '60', url], { encoding: 'utf8', timeout: 65_000 }).trim();
}
export function gradleCachePath(url, home) {
  const parsed = new URL(url);
  const name = path.posix.basename(parsed.pathname);
  if (parsed.origin !== 'https://services.gradle.org' ||
      !/^gradle-[0-9]+[.][0-9]+(?:[.][0-9]+)?-bin[.]zip$/.test(name)) {
    throw new Error('Unsupported Gradle distribution URL');
  }
  // Gradle Wrapper PathAssembler uses unsigned MD5 encoded in base36.
  const hash = BigInt('0x' + createHash('md5').update(url).digest('hex')).toString(36);
  return path.join(home, 'wrapper', 'dists', name.slice(0, -4), hash, name);
}
async function gradle() {
  // Expo currently uses React Native's wrapper pin. A future mismatch still
  // uses the real wrapper's normal download; this cache never forces a version.
  const props = fs.readFileSync('node_modules/@react-native/gradle-plugin/gradle/wrapper/gradle-wrapper.properties', 'utf8');
  const url = props.match(/^distributionUrl=(.+)$/m)?.[1].trim().replaceAll(String.fromCharCode(92) + ':', ':');
  const dest = gradleCachePath(url, process.env.GRADLE_USER_HOME || path.join(os.homedir(), '.gradle'));
  const name = path.basename(dest);
  const version = name.slice('gradle-'.length, -'-bin.zip'.length);
  const checksum = execFileSync('curl', ['--fail', '--location', '--silent', '--show-error',
    '--max-time', '60', url + '.sha256'], { encoding: 'utf8', timeout: 65_000 }).trim();
  const repo = 'gradle/gradle-distributions';
  download(repo, asset(release(repo, 'v' + version), name), checksum, dest);
  await kotlinCompiler();
}
export function kotlinVersions(rnVersion, module) {
  return [...new Set([rnVersion, ...module.variants.flatMap(v => v.dependencies || [])
    .filter(d => d.group === 'org.jetbrains.kotlin' && d.module === 'kotlin-gradle-plugin')
    .map(d => d.version.requires)])];
}
export async function kotlinCompiler() {
  const catalog = fs.readFileSync('node_modules/@react-native/gradle-plugin/gradle/libs.versions.toml', 'utf8');
  const agp = catalog.match(/^agp = "([0-9.]+)"/m)?.[1];
  const rnVersion = catalog.match(/^kotlin = "([0-9.]+)"/m)?.[1];
  if (!agp || !rnVersion) throw new Error('Cannot resolve upstream Kotlin toolchain');
  const module = JSON.parse(publicText('https://dl.google.com/dl/android/maven2/com/android/tools/build/gradle/' + agp + '/gradle-' + agp + '.module'));
  // React Native's included build and AGP can use different Kotlin compilers.
  for (const version of kotlinVersions(rnVersion, module)) {
    if (!/^[0-9]+[.][0-9]+[.][0-9]+$/.test(version)) throw new Error('Invalid Kotlin version');
    const name = 'kotlin-compiler-embeddable-' + version + '.jar';
    const sha1 = publicText('https://repo.maven.apache.org/maven2/org/jetbrains/kotlin/kotlin-compiler-embeddable/' + version + '/' + name + '.sha1');
    if (!/^[a-f0-9]{40}$/.test(sha1)) throw new Error('Invalid Maven compiler checksum');
    const entry = asset(release('JetBrains/kotlin', 'v' + version), name);
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-kotlin-'));
    try {
      const file = path.join(temp, name);
      const bytes = download('JetBrains/kotlin', entry, entry.digest?.replace('sha256:', ''), file);
      if (createHash('sha1').update(bytes).digest('hex') !== sha1) throw new Error('Maven compiler checksum mismatch');
      const home = process.env.GRADLE_USER_HOME || path.join(os.homedir(), '.gradle');
      const cache = path.join(home, 'caches/modules-2/files-2.1/org.jetbrains.kotlin/kotlin-compiler-embeddable', version, sha1);
      fs.mkdirSync(cache, { recursive: true });
      fs.copyFileSync(file, path.join(cache, name));
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  }
}
async function windows() {
  if (process.platform !== 'win32') throw new Error('Windows build requires Windows');
  const appVersion = process.argv[3];
  if (!/^[0-9]+[.][0-9]+[.][0-9]+$/.test(appVersion)) throw new Error('Invalid app version');
  const pkg = JSON.parse(fs.readFileSync('node_modules/electron/package.json', 'utf8'));
  const sums = JSON.parse(fs.readFileSync('node_modules/electron/checksums.json', 'utf8'));
  const name = 'electron-v' + pkg.version + '-win32-x64.zip';
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-electron-'));
  const archive = path.join(temp, name);
  let server;
  try {
    download('electron/electron', asset(release('electron/electron', 'v' + pkg.version), name), sums[name], archive);
    // Loopback-only mirror serves verified bytes and their original pinned sums.
    // Both Electron install and Forge retain their normal checksum validation.
    const prefix = '/v' + pkg.version + '/';
    const checksums = Object.entries(sums).map(([file, hash]) => hash + ' *' + file).join(String.fromCharCode(10));
    server = http.createServer((req, res) => {
      if (req.url === prefix + name) {
        res.setHeader('Content-Length', fs.statSync(archive).size);
        fs.createReadStream(archive).pipe(res);
      } else if (req.url === prefix + 'SHASUMS256.txt') { res.end(checksums); }
      else { res.writeHead(404); res.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const env = { ...process.env, ELECTRON_MIRROR: 'http://127.0.0.1:' + server.address().port + '/' };
    delete env.GH_TOKEN;
    await new Promise((resolve, reject) => {
      const child = spawn('cmd.exe', ['/d', '/s', '/c', 'pnpm release:package -- --platform win32 --arch x64 --region cn --version ' + appVersion + ' --no-sign'], { env, stdio: 'inherit' });
      child.once('error', reject);
      child.once('exit', code => code === 0 ? resolve() : reject(new Error('Windows packaging failed: ' + code)));
    });
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
async function ripgrep() {
  const { readPinnedVersion } = await import('../../tools/ripgrep/update.mjs');
  const version = readPinnedVersion();
  if (!/^[0-9]+[.][0-9]+[.][0-9]+$/.test(version)) throw new Error('Invalid ripgrep pin');
  const repo = 'BurntSushi/ripgrep';
  const meta = release(repo, version);
  const name = 'ripgrep-' + version + '-x86_64-pc-windows-msvc.zip';
  const checksum = api('repos/' + repo + '/releases/assets/' + asset(meta, name + '.sha256').id, true)
    .toString('utf8').match(/[a-fA-F0-9]{64}/)?.[0].toLowerCase();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-ripgrep-'));
  try {
    const archive = path.join(temp, name);
    download(repo, asset(meta, name), checksum, archive);
    execFileSync('tar', ['-xf', archive, '-C', temp]);
    const binary = path.join(temp, name.slice(0, -4), 'rg.exe');
    if (fs.statSync(binary).size < 1024) throw new Error('Invalid extracted ripgrep');
    const dest = path.resolve('apps/ripgrep-bin/win32-x64');
    fs.mkdirSync(dest, { recursive: true });
    fs.copyFileSync(binary, path.join(dest, 'rg.exe'));
    fs.writeFileSync(path.join(dest, '.version'), version + '\n');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const prepare = { gradle, ripgrep, windows }[process.argv[2]];
  if (!prepare) throw new Error('Expected gradle, ripgrep or windows');
  await prepare();
}
