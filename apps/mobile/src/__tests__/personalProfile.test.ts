import { describe, expect, it } from "vitest";

import { isCompanionsEnabled, isComposerVoiceInputEnabled } from "@/config/personalProfile";

describe("mobile personal profile voice gate", () => {
  it("disables composer voice input only on Android", () => {
    expect(isComposerVoiceInputEnabled("android")).toBe(false);
    expect(isComposerVoiceInputEnabled("ios")).toBe(true);
    expect(isComposerVoiceInputEnabled("web")).toBe(true);
  });

  it("disables companions only on Android", () => {
    expect(isCompanionsEnabled("android")).toBe(false);
    expect(isCompanionsEnabled("ios")).toBe(true);
    expect(isCompanionsEnabled("web")).toBe(true);
  });
});
