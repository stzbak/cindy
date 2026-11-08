import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchPersonalLatestRelease,
  resetPersonalLatestReleaseCacheForTests,
} from './fetchPersonalLatestRelease';

const RELEASE_API = 'https://api.github.com/repos/stzbak/cindy/releases/latest';
const APK_URL =
  'https://github.com/stzbak/cindy/releases/download/personal-v1.0.11/cindy-personal-android.apk';
const META_URL =
  'https://github.com/stzbak/cindy/releases/download/personal-v1.0.11/cindy-personal-android.json';

function response(status: number, json?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => json ?? {},
  };
}

function releaseBody(assets: Array<{ name: string; browser_download_url: string }>) {
  return {
    draft: false,
    prerelease: false,
    assets,
  };
}

beforeEach(() => {
  resetPersonalLatestReleaseCacheForTests();
});

describe('fetchPersonalLatestRelease', () => {
  it('reads metadata from the latest fork release and pins the APK asset URL', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(200, releaseBody([
        { name: 'cindy-personal-android.apk', browser_download_url: APK_URL },
        { name: 'cindy-personal-android.json', browser_download_url: META_URL },
      ])))
      .mockResolvedValueOnce(response(200, {
        version: '1.0.11',
        buildNumber: 100011,
        runtimeVersion: 'rtv-personal',
        releaseNotes: 'Personal build',
      }));

    await expect(fetchPersonalLatestRelease(8000, fetchMock as unknown as typeof fetch)).resolves.toEqual({
      version: '1.0.11',
      buildNumber: 100011,
      runtimeVersion: 'rtv-personal',
      installUrl: APK_URL,
      itmsUrl: '',
      releaseNotes: 'Personal build',
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(RELEASE_API);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(META_URL);
  });

  it('treats a missing release as no update', async () => {
    const fetchMock = vi.fn(async () => response(404));
    await expect(fetchPersonalLatestRelease(8000, fetchMock as unknown as typeof fetch)).resolves.toBeNull();
  });

  it('fails closed when the release does not contain both Personal assets', async () => {
    const fetchMock = vi.fn(async () => response(200, releaseBody([
      { name: 'cindy-personal-android.apk', browser_download_url: APK_URL },
    ])));
    await expect(fetchPersonalLatestRelease(8000, fetchMock as unknown as typeof fetch)).rejects.toThrow(
      /missing its signed Android assets/,
    );
  });

  it('rejects asset URLs outside the pinned stzbak/cindy release path', async () => {
    const fetchMock = vi.fn(async () => response(200, releaseBody([
      { name: 'cindy-personal-android.apk', browser_download_url: 'https://evil.example/app.apk' },
      { name: 'cindy-personal-android.json', browser_download_url: META_URL },
    ])));
    await expect(fetchPersonalLatestRelease(8000, fetchMock as unknown as typeof fetch)).rejects.toThrow(
      /missing its signed Android assets/,
    );
  });

  it('reuses a valid record briefly to avoid hammering the public GitHub API', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(200, releaseBody([
        { name: 'cindy-personal-android.apk', browser_download_url: APK_URL },
        { name: 'cindy-personal-android.json', browser_download_url: META_URL },
      ])))
      .mockResolvedValueOnce(response(200, {
        version: '1.0.11',
        buildNumber: 100011,
        runtimeVersion: 'rtv-personal',
      }));

    await fetchPersonalLatestRelease(8000, fetchMock as unknown as typeof fetch);
    await fetchPersonalLatestRelease(8000, fetchMock as unknown as typeof fetch);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
