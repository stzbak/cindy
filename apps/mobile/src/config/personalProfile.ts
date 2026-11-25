/**
 * Personal-fork feature gates. Keep platform decisions in this file so the
 * fork delta stays small when the Android client is updated from upstream.
 */
export const PERSONAL_PROFILE_FEATURES = Object.freeze({
  disableAndroidComposerVoiceInput: true,
  disableAndroidVoiceSettings: true,
  disableAndroidCompanions: true,
  disableAndroidTapdb: true,
  disableAndroidHandheldMode: true,
  disableAndroidUsageWidgets: true,
  disableAndroidSharedTasks: true,
  disableAndroidGiftCard: true,
  androidMaxRecentTasks: 3,
  useGitHubReleasesForAndroidUpdates: true,
});

export function isComposerVoiceInputEnabled(platform: string): boolean {
  return !(
    PERSONAL_PROFILE_FEATURES.disableAndroidComposerVoiceInput && platform === 'android'
  );
}

/** Voice dictionary sync and speaker filter settings are disabled on Android Personal. */
export function isMobileVoiceSettingsEnabled(platform: string): boolean {
  return !(
    PERSONAL_PROFILE_FEATURES.disableAndroidVoiceSettings && platform === 'android'
  );
}

/** Companion routes, rosters and Chat Server reads are removed from Android Personal. */
export function isCompanionsEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableAndroidCompanions && platform === 'android');
}

/** Official TapDB credentials cannot initialize under the Personal package/signature. */
export function isMobileTapdbEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableAndroidTapdb && platform === 'android');
}

/** Gaming handheld key/secondary-display bridge is disabled on Android Personal. */
export function isHandheldModeEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableAndroidHandheldMode && platform === 'android');
}

/** Periodic desktop-quota polling for home-screen widgets is disabled on Android Personal. */
export function isUsageWidgetsEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableAndroidUsageWidgets && platform === 'android');
}

/** Cross-account shared tasks are disabled on Android Personal; own device-link stays active. */
export function isSharedTasksEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableAndroidSharedTasks && platform === 'android');
}

/** Gift card redemption entrypoints are disabled on Android Personal. */
export function isGiftCardEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableAndroidGiftCard && platform === 'android');
}

/** Resident task tree LRU limit: reduced to 3 on Android Personal to trim background memory. */
export function getMaxRecentTasks(platform: string, defaultMax = 5): number {
  return platform === 'android' ? PERSONAL_PROFILE_FEATURES.androidMaxRecentTasks : defaultMax;
}

/** Personal Android uses its own signed GitHub Release feed instead of the official APK feed. */
export function isPersonalAndroidUpdateFeedEnabled(platform: string): boolean {
  return (
    PERSONAL_PROFILE_FEATURES.useGitHubReleasesForAndroidUpdates &&
    platform === 'android'
  );
}
