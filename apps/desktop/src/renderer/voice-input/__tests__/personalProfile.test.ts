import { describe, expect, it } from 'vitest';

import {
  isCompanionCallsEnabled,
  isCompanionsEnabled,
  isComposerVoiceInputEnabled,
} from '../../../shared/personalProfile';

describe('desktop personal profile voice gate', () => {
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
