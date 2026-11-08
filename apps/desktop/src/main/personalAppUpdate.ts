import type { AppManifest } from './manifestService';
import { compareAppUpdateVersions, type AppUpdateVersionRelation, parseAppUpdateVersion } from './updateVersionPolicy';
import { PERSONAL_BUILD_NUMBER } from '../shared/personalBuild';
import { isPersonalAppUpdateEnabled } from '../shared/personalProfile';

const RELEASE_API = 'https://api.github.com/repos/stzbak/cindy/releases/latest';
const ASSET_PREFIX = '/stzbak/cindy/releases/download/';

export function isPersonalAppAssetUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password
      && !url.search && !url.hash && url.pathname.startsWith(ASSET_PREFIX);
  } catch { return false; }
}

export function appUpdateDownloadUrl(file: string, baseUrl: string): string {
  if (/^https?:/i.test(file)) {
    if (!isPersonalAppUpdateEnabled(process.platform) || !isPersonalAppAssetUrl(file)) {
      throw new Error('Untrusted Personal application update URL');
    }
    return file;
  }
  return baseUrl + '/' + file;
}

export function comparePersonalAppUpdateVersions(
  target: unknown, current: unknown, targetBuild?: number, currentBuild = PERSONAL_BUILD_NUMBER,
): AppUpdateVersionRelation {
  const relation = compareAppUpdateVersions(target, current);
  if (!isPersonalAppUpdateEnabled(process.platform) || currentBuild === 0) return relation;
  if (relation === 'invalid' || !Number.isSafeInteger(targetBuild) || (targetBuild ?? 0) <= 0) return 'invalid';
  if (relation === 'older') return 'older';
  if (targetBuild! < currentBuild) return 'older';
  if (targetBuild === currentBuild) return relation === 'same' ? 'same' : 'invalid';
  return 'newer';
}

/** Only the app entry is replaced. Engine manifests and download bases remain official. */
export async function fetchPersonalWindowsAppManifest(
  timeoutMs = 8000, signal?: AbortSignal, fetchImpl: (url: string, options?: RequestInit) => Promise<Response> = fetch,
): Promise<AppManifest> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  const timer = setTimeout(cancel, timeoutMs);
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  try {
    const response = await fetchImpl(RELEASE_API, { signal: controller.signal, headers: { accept: 'application/vnd.github+json', 'cache-control': 'no-cache' } });
    if (!response.ok) throw new Error('Personal release request failed: HTTP ' + response.status);
    const release = await response.json();
    if (release.draft || release.prerelease || !Array.isArray(release.assets)) throw new Error('Personal stable release unavailable');
    const manifestAsset = release.assets.find((asset: { name?: string }) => asset.name === 'cindy-personal-windows.json');
    if (!isPersonalAppAssetUrl(manifestAsset?.browser_download_url)) throw new Error('Missing Personal Windows update manifest');
    const manifestResponse = await fetchImpl(manifestAsset.browser_download_url, { signal: controller.signal, headers: { 'cache-control': 'no-cache' } });
    if (!manifestResponse.ok) throw new Error('Personal Windows manifest request failed');
    const value = await manifestResponse.json();
    const app = value?.app as AppManifest;
    if (value?.region !== 'cn' || value?.platform !== 'win32-x64' || !app || !parseAppUpdateVersion(app.version)
        || !Number.isSafeInteger(app.personalBuildNumber) || (app.personalBuildNumber ?? 0) <= 0) {
      throw new Error('Invalid Personal Windows update identity');
    }
    for (const asset of [app.hotfix, app.installer]) {
      if (!asset || !isPersonalAppAssetUrl(asset.file) || !/^[a-f0-9]{64}$/i.test(asset.sha256)
          || !Number.isSafeInteger(asset.size) || asset.size <= 0
          || !release.assets.some((entry: { browser_download_url?: string }) => entry.browser_download_url === asset.file)) {
        throw new Error('Invalid Personal Windows update asset');
      }
    }
    if (!app.hotfix!.file.endsWith('.zip') || !app.installer!.file.endsWith('.exe')) throw new Error('Unexpected Personal Windows asset format');
    return app;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}
