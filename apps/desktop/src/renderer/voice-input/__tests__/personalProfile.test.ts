import { describe, expect, it } from 'vitest';

import {
  isAuxiliaryWindowPrewarmEnabled,
  isImBotsEnabled,
  isCompanionCallsEnabled,
  isCompanionsEnabled,
  isComposerVoiceInputEnabled,
} from '../../../shared/personalProfile';

describe('desktop personal profile voice gate', () => {
  // Unit: Windows resource policy; other desktop platforms retain upstream behavior.
  it.each(['win32', 'darwin', 'linux'])('gates auxiliary prewarm and IM bots on %s', (platform) => {
    expect(isAuxiliaryWindowPrewarmEnabled(platform)).toBe(platform !== 'win32');
    expect(isImBotsEnabled(platform)).toBe(platform !== 'win32');
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
