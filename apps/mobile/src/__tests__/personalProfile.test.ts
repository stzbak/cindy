import { describe, expect, it } from "vitest";

import {
  getMaxRecentTasks,
  isCompanionsEnabled,
  isComposerVoiceInputEnabled,
  isGiftCardEnabled,
  isHandheldModeEnabled,
  isMobileTapdbEnabled,
  isMobileVoiceSettingsEnabled,
  isPersonalAndroidUpdateFeedEnabled,
  isSharedTasksEnabled,
  isUsageWidgetsEnabled,
} from "@/config/personalProfile";
import { getRecentTasks, MAX_RECENT_TASKS, rememberRecentTask, setRecentTaskLimit } from "@/session/recentTasks";

describe("mobile personal profile voice gate", () => {
  it("disables composer voice input and voice settings only on Android", () => {
    expect(isComposerVoiceInputEnabled("android")).toBe(false);
    expect(isComposerVoiceInputEnabled("ios")).toBe(true);
    expect(isComposerVoiceInputEnabled("web")).toBe(true);
    expect(isMobileVoiceSettingsEnabled("android")).toBe(false);
    expect(isMobileVoiceSettingsEnabled("ios")).toBe(true);
  });

  it("disables companions only on Android", () => {
    expect(isCompanionsEnabled("android")).toBe(false);
    expect(isCompanionsEnabled("ios")).toBe(true);
    expect(isCompanionsEnabled("web")).toBe(true);
  });

  it("disables official TapDB only on Android", () => {
    expect(isMobileTapdbEnabled("android")).toBe(false);
    expect(isMobileTapdbEnabled("ios")).toBe(true);
  });

  it("disables handheld mode, usage widgets, shared tasks, and gift cards only on Android", () => {
    expect(isHandheldModeEnabled("android")).toBe(false);
    expect(isHandheldModeEnabled("ios")).toBe(true);
    expect(isUsageWidgetsEnabled("android")).toBe(false);
    expect(isUsageWidgetsEnabled("ios")).toBe(true);
    expect(isSharedTasksEnabled("android")).toBe(false);
    expect(isSharedTasksEnabled("ios")).toBe(true);
    expect(isGiftCardEnabled("android")).toBe(false);
    expect(isGiftCardEnabled("ios")).toBe(true);
  });

  it("caps resident recent tasks to 3 on Android while preserving 5 elsewhere", () => {
    expect(getMaxRecentTasks("android")).toBe(3);
    expect(getMaxRecentTasks("ios")).toBe(5);
    expect(getMaxRecentTasks("web")).toBe(5);

    try {
      setRecentTaskLimit(getMaxRecentTasks("android"));
      for (let i = 1; i <= 5; i += 1) {
        rememberRecentTask({
          pathname: "/sessions/[sessionId]",
          params: { deviceId: "dev-1", deviceName: "PC", sessionId: `s-${i}` },
        });
      }
      expect(getRecentTasks().map((item) => item.params.sessionId)).toEqual([
        "s-3",
        "s-4",
        "s-5",
      ]);
    } finally {
      setRecentTaskLimit(MAX_RECENT_TASKS);
    }
  });

  it("uses the Personal GitHub release feed only on Android", () => {
    expect(isPersonalAndroidUpdateFeedEnabled("android")).toBe(true);
    expect(isPersonalAndroidUpdateFeedEnabled("ios")).toBe(false);
  });
});
