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
// Gradle included builds compile with their own Kotlin plugin: React Native's
// catalog, AGP's requirement and Expo's plugin each pin a different compiler.
// The literal fallbacks only enumerate candidates; absent releases are skipped
// and the real Gradle build still fails closed if a compiler is unavailable.
const KOTLIN_FALLBACKS = ['2.2.0', '2.2.10', '2.2.21'];
export function kotlinCompilerVersions(texts, module) {
  const found = new Set(KOTLIN_FALLBACKS);
  for (const text of texts) {
    for (const match of text.matchAll(/^[ \t]*kotlin[ \t]*=[ \t]*"([0-9]+[.][0-9]+[.][0-9]+)"|kotlin\("jvm"\)[ \t]*version[ \t]*"([0-9]+[.][0-9]+[.][0-9]+)"/gm)) {
      found.add(match[1] || match[2]);
    }
  }
  for (const dependency of module.variants.flatMap(v => v.dependencies || [])) {
    if (dependency.group === 'org.jetbrains.kotlin' && dependency.module === 'kotlin-gradle-plugin') {
      found.add(dependency.version.requires);
    }
  }
  return [...found].filter(version => /^[0-9]+[.][0-9]+[.][0-9]+$/.test(version)).sort();
}
export function builderTools(sources) {
  return sources.flatMap(source => [...source.matchAll(/getBinFromUrl[^"]+"(nsis(?:-resources)?)", *"([0-9.]+)", *"([A-Za-z0-9+/=]+)"/g)]
    .map(([, name, version, checksum]) => ({ name, version, checksum })));
}
export function builderArchives(temp) {
  const sources = ['nsisUtil.js', 'NsisTarget.js'].map(file =>
    fs.readFileSync('node_modules/app-builder-lib/out/targets/nsis/' + file, 'utf8'));
  const tools = builderTools(sources);
  if (tools.length !== 2 || new Set(tools.map(tool => tool.name)).size !== 2) throw new Error('Cannot resolve pinned NSIS tools');
  const files = new Map();
  for (const tool of tools) {
    const tag = tool.name + '-' + tool.version;
    const name = tag + '.7z';
    const repo = 'electron-userland/electron-builder-binaries';
    const entry = asset(release(repo, tag), name);
    const bytes = api('repos/' + repo + '/releases/assets/' + entry.id, true);
    // Legacy NSIS releases have no GitHub SHA256 digest. Preserve the stronger
    // SHA512 pinned in the installed builder package, also rechecked by builder.
    if (bytes.length !== entry.size || createHash('sha512').update(bytes).digest('base64') !== tool.checksum) {
      throw new Error('Pinned NSIS SHA512 mismatch');
    }
    const dest = path.join(temp, name);
    fs.writeFileSync(dest, bytes);
    files.set('/' + tag + '/' + name, dest);
    console.log('Verified pinned official asset: ' + name);
  }
  return files;
}
export async function kotlinCompiler() {
  const catalogPaths = [
    'node_modules/@react-native/gradle-plugin/gradle/libs.versions.toml',
    'node_modules/react-native/gradle/libs.versions.toml',
    'node_modules/expo-modules-autolinking/android/expo-gradle-plugin/build.gradle.kts',
  ];
  const catalog = fs.readFileSync(catalogPaths[0], 'utf8');
  const agp = catalog.match(/^agp = "([0-9.]+)"/m)?.[1];
  if (!agp) throw new Error('Cannot resolve upstream Kotlin toolchain');
  const module = JSON.parse(publicText('https://dl.google.com/dl/android/maven2/com/android/tools/build/gradle/' + agp + '/gradle-' + agp + '.module'));
  const texts = catalogPaths.filter(file => fs.existsSync(file)).map(file => fs.readFileSync(file, 'utf8'));
  for (const version of kotlinCompilerVersions(texts, module)) {
    const name = 'kotlin-compiler-embeddable-' + version + '.jar';
    let sha1;
    try {
      sha1 = publicText('https://repo.maven.apache.org/maven2/org/jetbrains/kotlin/kotlin-compiler-embeddable/' + version + '/' + name + '.sha1');
    } catch { continue; }
    if (!/^[a-f0-9]{40}$/.test(sha1)) throw new Error('Invalid Maven compiler checksum');
    let meta;
    try { meta = release('JetBrains/kotlin', 'v' + version); } catch { continue; }
    const found = meta.assets.find(assetEntry => assetEntry.name === name);
    if (!found?.digest) {
      console.log('Skipping unpinned Kotlin compiler candidate ' + version);
      continue;
    }
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-kotlin-'));
    try {
      const file = path.join(temp, name);
      const bytes = download('JetBrains/kotlin', found, found.digest.replace('sha256:', ''), file);
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
    const builderFiles = builderArchives(temp);
    // Loopback-only mirror serves verified bytes and their original pinned sums.
    // Both Electron install and Forge retain their normal checksum validation.
    const prefix = '/v' + pkg.version + '/';
    const checksums = Object.entries(sums).map(([file, hash]) => hash + ' *' + file).join(String.fromCharCode(10));
    server = http.createServer((req, res) => {
      const file = req.url === prefix + name ? archive : builderFiles.get(req.url);
      if (file) {
        res.setHeader('Content-Length', fs.statSync(file).size);
        fs.createReadStream(file).pipe(res);
      } else if (req.url === prefix + 'SHASUMS256.txt') { res.end(checksums); }
      else { res.writeHead(404); res.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const env = { ...process.env, ELECTRON_MIRROR: 'http://127.0.0.1:' + server.address().port + '/' };
    env.ELECTRON_BUILDER_BINARIES_MIRROR = env.ELECTRON_MIRROR;
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
