/**
 * Personal-fork feature gates shared by the desktop process boundaries.
 *
 * Keeping platform decisions here makes the fork delta small and gives upstream
 * merges one stable file to reconcile when the personal profile changes.
 */
export const PERSONAL_PROFILE_FEATURES = Object.freeze({
  usePersonalWindowsUpdates: true,
  disableWindowsComposerVoiceInput: true,
  disableWindowsCompanions: true,
  disableWindowsCompanionCalls: true,
  disableWindowsAuxiliaryPrewarm: true,
  disableWindowsImBots: true,
});

/** Personal Windows trades first-open latency for lower startup/resident cost. */
export function isAuxiliaryWindowPrewarmEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableWindowsAuxiliaryPrewarm && platform === 'win32');
}

/** Chat bot ingress is independent from notifications, scheduler and device-link. */
export function isImBotsEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableWindowsImBots && platform === 'win32');
}

export function isPersonalAppUpdateEnabled(platform: string): boolean {
  return PERSONAL_PROFILE_FEATURES.usePersonalWindowsUpdates && platform === 'win32';
}

export function isComposerVoiceInputEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableWindowsComposerVoiceInput && platform === 'win32');
}

/** Companion pages, runtimes and tools are removed from the Windows personal build. */
export function isCompanionsEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableWindowsCompanions && platform === 'win32');
}

/** Voice calls are a companion-only capability in the desktop client. */
export function isCompanionCallsEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableWindowsCompanionCalls && platform === 'win32');
}
