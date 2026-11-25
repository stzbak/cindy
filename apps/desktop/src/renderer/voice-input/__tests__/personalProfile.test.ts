import { describe, expect, it } from 'vitest';

import {
  isAuxiliaryWindowPrewarmEnabled,
  isCloudBackgroundPollersEnabled,
  isCompanionCallsEnabled,
  isCompanionsEnabled,
  isComposerVoiceInputEnabled,
  isDesktopTelemetryEnabled,
  isGlobalVoiceInputEnabled,
  isImBotsEnabled,
  isInputDevicesEnabled,
  isPluginMarketAutoSyncEnabled,
  isSharedTasksEnabled,
} from '../../../shared/personalProfile';

describe('desktop personal profile voice gate', () => {
  // Unit: Windows resource policy; other desktop platforms retain upstream behavior.
  it.each(['win32', 'darwin', 'linux'])('gates Windows resource reductions on %s', (platform) => {
    const enabled = platform !== 'win32';
    expect(isAuxiliaryWindowPrewarmEnabled(platform)).toBe(enabled);
    expect(isImBotsEnabled(platform)).toBe(enabled);
    expect(isGlobalVoiceInputEnabled(platform)).toBe(enabled);
    expect(isInputDevicesEnabled(platform)).toBe(enabled);
    expect(isSharedTasksEnabled(platform)).toBe(enabled);
    expect(isPluginMarketAutoSyncEnabled(platform)).toBe(enabled);
    expect(isCloudBackgroundPollersEnabled(platform)).toBe(enabled);
    expect(isDesktopTelemetryEnabled(platform)).toBe(enabled);
  });

  it('disables composer voice input only on Windows', () => {
    expect(isComposerVoiceInputEnabled('win32')).toBe(false);
    expect(isComposerVoiceInputEnabled('darwin')).toBe(true);
    expect(isComposerVoiceInputEnabled('linux')).toBe(true);
  });

  it('disables companions and companion calls only on Windows', () => {
    expect(isCompanionsEnabled('win32')).toBe(false);
    expect(isCompanionCallsEnabled('win32')).toBe(false);
    expect(isCompanionsEnabled('linux')).toBe(true);
    expect(isCompanionCallsEnabled('linux')).toBe(true);
    expect(isCompanionsEnabled('darwin')).toBe(true);
    expect(isCompanionCallsEnabled('darwin')).toBe(true);
  });
});
