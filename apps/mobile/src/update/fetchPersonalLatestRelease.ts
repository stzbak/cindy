import { parseLatestRelease } from './bundleUpdate';

const RELEASE_API_URL =
  'https://api.github.com/repos/stzbak/cindy/releases/latest';
const APK_ASSET_NAME = 'cindy-personal-android.apk';
const METADATA_ASSET_NAME = 'cindy-personal-android.json';
const CACHE_TTL_MS = 5 * 60 * 1000;

interface GitHubReleaseAsset {
  name?: unknown;
  browser_download_url?: unknown;
}

interface GitHubRelease {
  draft?: unknown;
  prerelease?: unknown;
  assets?: unknown;
}

let cached:
  | { expiresAt: number; value: ReturnType<typeof parseLatestRelease> }
  | null = null;

function isPersonalReleaseAssetUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      url.pathname.startsWith('/stzbak/cindy/releases/download/')
    );
  } catch {
    return false;
  }
}

function findAsset(release: GitHubRelease, name: string): GitHubReleaseAsset | null {
  if (!Array.isArray(release.assets)) return null;
  return (
    release.assets.find((asset): asset is GitHubReleaseAsset => (
      Boolean(asset) &&
      typeof asset === 'object' &&
      (asset as GitHubReleaseAsset).name === name
    )) ?? null
  );
}

/**
 * Read the latest Personal Android release from the fork's public GitHub Releases.
 * The JSON asset carries version/buildNumber/runtimeVersion; the APK URL is taken
 * from the release asset list so it always follows a re-uploaded package.
 */
export async function fetchPersonalLatestRelease(
  timeoutMs = 8000,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown | null> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const releaseResponse = await fetchImpl(
      RELEASE_API_URL + '?t=' + now,
      {
        signal: controller.signal,
        headers: {
          accept: 'application/vnd.github+json',
          'cache-control': 'no-cache',
        },
      },
    );
    if (releaseResponse.status === 404) return null;
    if (!releaseResponse.ok) {
      throw new Error('Personal update release request failed: HTTP ' + releaseResponse.status);
    }

    const release = await releaseResponse.json() as GitHubRelease;
    if (release.draft === true || release.prerelease === true) return null;

    const apkAsset = findAsset(release, APK_ASSET_NAME);
    const metadataAsset = findAsset(release, METADATA_ASSET_NAME);
    const installUrl = apkAsset?.browser_download_url;
    const metadataUrl = metadataAsset?.browser_download_url;
    if (
      !isPersonalReleaseAssetUrl(installUrl) ||
      !isPersonalReleaseAssetUrl(metadataUrl)
    ) {
      throw new Error('Personal update release is missing its signed Android assets');
    }

    const metadataResponse = await fetchImpl(
      metadataUrl + '?t=' + now,
      {
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'cache-control': 'no-cache',
        },
      },
    );
    if (!metadataResponse.ok) {
      throw new Error(
        'Personal update metadata request failed: HTTP ' + metadataResponse.status,
      );
    }

    const metadata = await metadataResponse.json();
    const record = parseLatestRelease({
      ...(metadata && typeof metadata === 'object' ? metadata : {}),
      installUrl,
      itmsUrl: '',
    });
    if (!record) throw new Error('Personal update metadata is invalid');

    cached = { expiresAt: now + CACHE_TTL_MS, value: record };
    return record;
  } finally {
    clearTimeout(timer);
  }
}

export function resetPersonalLatestReleaseCacheForTests(): void {
  cached = null;
}
