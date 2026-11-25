/**
 * Personal-fork feature gates shared by the desktop process boundaries.
 *
 * Keeping platform decisions here makes the fork delta small and gives upstream
 * merges one stable file to reconcile when the personal profile changes.
 */
export const PERSONAL_PROFILE_FEATURES = Object.freeze({
  usePersonalWindowsUpdates: true,
  disableWindowsComposerVoiceInput: true,
  disableWindowsGlobalVoiceInput: true,
  disableWindowsCompanions: true,
  disableWindowsCompanionCalls: true,
  disableWindowsAuxiliaryPrewarm: true,
  disableWindowsImBots: true,
  disableWindowsInputDevices: true,
  disableWindowsSharedTasks: true,
  disableWindowsPluginMarketAutoSync: true,
  disableWindowsCloudBackgroundPollers: true,
  disableWindowsTelemetry: true,
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

/** Global voice shortcuts, native key listeners and settings are disabled on Windows Personal. */
export function isGlobalVoiceInputEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableWindowsGlobalVoiceInput && platform === 'win32');
}

/** Companion pages, runtimes and tools are removed from the Windows personal build. */
export function isCompanionsEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableWindowsCompanions && platform === 'win32');
}

/** Voice calls are a companion-only capability in the desktop client. */
export function isCompanionCallsEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableWindowsCompanionCalls && platform === 'win32');
}

/** External gamepads and macro keyboards are disabled on Windows Personal. */
export function isInputDevicesEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableWindowsInputDevices && platform === 'win32');
}

/** Cross-account shared tasks are disabled on Windows Personal; own device-link stays active. */
export function isSharedTasksEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableWindowsSharedTasks && platform === 'win32');
}

/** Periodic/startup plugin marketplace auto-sync is disabled on Windows Personal; manual plugin UI stays usable. */
export function isPluginMarketAutoSyncEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableWindowsPluginMarketAutoSync && platform === 'win32');
}

/** Non-essential foreground cloud pollers (plugin review status, cloud instance access) are disabled on Windows Personal. */
export function isCloudBackgroundPollersEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableWindowsCloudBackgroundPollers && platform === 'win32');
}

/** Official heartbeat, TapDB analytics reporting and startup log backfill are disabled on Windows Personal. */
export function isDesktopTelemetryEnabled(platform: string): boolean {
  return !(PERSONAL_PROFILE_FEATURES.disableWindowsTelemetry && platform === 'win32');
}
