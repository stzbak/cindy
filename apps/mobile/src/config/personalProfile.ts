/**
 * Personal-fork feature gates. Keep platform decisions in this file so the
 * fork delta stays small when the Android client is updated from upstream.
 */
export const PERSONAL_PROFILE_FEATURES = Object.freeze({
  disableAndroidComposerVoiceInput: true,
  disableAndroidCompanions: true,
});

export function isComposerVoiceInputEnabled(platform: string): boolean {
  return !(
    PERSONAL_PROFILE_FEATURES.disableAndroidComposerVoiceInput && platform === 'android'
  );
}

/** Companion routes, rosters and Chat Server reads are removed from Android Personal. */
export function isCompanionsEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableAndroidCompanions && platform === 'android');
}
