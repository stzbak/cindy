import { afterEach, describe, expect, it, vi } from 'vitest';
import { appUpdateDownloadUrl, comparePersonalAppUpdateVersions, fetchPersonalWindowsAppManifest } from '../personalAppUpdate';

// Unit: protect the Personal feed trust boundary and same-official-version rebuilds.
const platform = process.platform;
const base = 'https://github.com/stzbak/cindy/releases/download/personal-test/';
const asset = (name: string) => ({ file: base + name, sha256: 'a'.repeat(64), size: 12 });
const app = { version: '0.1.121', personalBuildNumber: 200002, hotfix: asset('app.zip'), installer: asset('app.exe') };
const release = { assets: ['cindy-personal-windows.json', 'app.zip', 'app.exe'].map(name => ({ name, browser_download_url: base + name })) };
afterEach(() => { Object.defineProperty(process, 'platform', { value: platform }); });

describe('Personal Windows updates', () => {
  it.each([
    [200002, '0.1.121', 'newer'],
    [200001, '0.1.121', 'same'],
    [200000, '0.1.121', 'older'],
    [undefined, '0.1.122', 'invalid'],
    [200002, '0.1.120', 'older'],
  ] as const)('compares build %s at official version %s', (targetBuild, version, expected) => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    expect(comparePersonalAppUpdateVersions(version, '0.1.121', targetBuild, 200001)).toBe(expected);
  });

  it('keeps upstream SemVer behavior on Linux', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    expect(comparePersonalAppUpdateVersions('0.1.121', '0.1.121', 200002, 200001)).toBe('same');
    expect(appUpdateDownloadUrl('engine/cli.gz', 'https://official.invalid')).toBe('https://official.invalid/engine/cli.gz');
    expect(() => appUpdateDownloadUrl(base + 'app.zip', 'https://official.invalid')).toThrow();
  });

  it('reads only release-listed, hashed Personal application assets', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(release)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ region: 'cn', platform: 'win32-x64', app })));
    await expect(fetchPersonalWindowsAppManifest(1000, undefined, fetcher)).resolves.toEqual(app);
    expect(appUpdateDownloadUrl(app.hotfix.file, 'https://official.invalid')).toBe(app.hotfix.file);
    expect(() => appUpdateDownloadUrl('https://github.com/other/repo/app.zip', '')).toThrow();
  });

  it.each(['unlisted', 'foreign-repo', 'bad-hash', 'wrong-region', 'prerelease'])('rejects %s instead of returning an official app update', async (kind) => {
    const data = structuredClone({ region: 'cn', platform: 'win32-x64', app });
    if (kind === 'unlisted') data.app.hotfix.file = base + 'unlisted.zip';
    if (kind === 'foreign-repo') data.app.hotfix.file = 'https://github.com/other/repo/app.zip';
    if (kind === 'bad-hash') data.app.hotfix.sha256 = '';
    if (kind === 'wrong-region') data.region = 'global';
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ...release, prerelease: kind === 'prerelease' })))
      .mockResolvedValueOnce(new Response(JSON.stringify(data)));
    await expect(fetchPersonalWindowsAppManifest(1000, undefined, fetcher)).rejects.toThrow();
  });
});
