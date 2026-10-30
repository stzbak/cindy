import { isCompanionsEnabled } from '../../shared/personalProfile.js';

export interface BotSessionInputSnapshot {
  source: string;
  role: string | null;
  profileStatus: string | null;
}

export function botSessionInputBlockReason(
  snapshot: BotSessionInputSnapshot | null,
  platform = process.platform,
): string | null {
  if (!snapshot || snapshot.source !== 'bot') return null;
  if (!isCompanionsEnabled(platform)) {
    return '伙伴功能已在 Personal 版停用，旧伙伴任务仅保留只读历史';
  }
  if (!snapshot.role || !snapshot.profileStatus) {
    return 'Bot 任务的归属信息不完整，无法继续发送消息';
  }
  if (snapshot.role === 'history') {
    return 'Bot 历史任务为只读，不能继续发送消息';
  }
  if (snapshot.profileStatus !== 'active') {
    return 'Bot 当前未启用，请先恢复 Bot 后再发送消息';
  }
  return null;
}

export const SHADOWED_COMPANION_INPUT_MESSAGE =
  'This teammate now runs on its main computer; continue it there or take it over on this computer';

/**
 * A demoted copy's companion runs on another computer (cloud-companions.md §3): its main
 * and routine tasks never start a turn here, whichever send path (renderer, internal, queue drain) asks.
 */
export function isShadowedCompanionSession(
  link: { role?: string | null; botId?: string | null } | null | undefined,
  isShadowed: (botId: string) => boolean,
): boolean {
  return (link?.role === 'canonical' || link?.role === 'routine') && !!link.botId && isShadowed(link.botId);
}
