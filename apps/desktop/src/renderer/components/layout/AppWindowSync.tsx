import { isCompanionsEnabled } from '../../../shared/personalProfile';
import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDataOwnerGeneration } from '@/contexts/dataOwnerGeneration';
import { startBotReadStateSync } from '@/features/bots/botReadState';
import { startBotGroupOutbox } from '@/features/bots/botGroupOutbox';
import { useBotUnreadSync } from '@/features/bots/useBotUnreadSync';
import { useRemoteBotSync } from '@/features/bots/useRemoteBots';
import { isSecondaryWindow } from '@/lib/secondaryWindow';
import { isSidebarWindow } from '@/lib/sidebarWindow';
import { AppBadgeAttentionSync } from './AppBadgeAttentionSync';

/** Full-app state survives sibling routes; only the main window publishes system attention. */
function ReadyAppWindowSync() {
  const companionsEnabled = isCompanionsEnabled(window.electronAPI?.platform ?? '');
  const owner = getDataOwnerGeneration();
  // Register read bootstrap before list effects can discover new identities.
  useEffect(() => companionsEnabled ? startBotReadStateSync() : undefined, [owner, companionsEnabled]);
  useBotUnreadSync(companionsEnabled);
  useRemoteBotSync(companionsEnabled);
  useEffect(() => companionsEnabled ? startBotGroupOutbox() : undefined, [owner, companionsEnabled]);
  return isSecondaryWindow() ? null : <AppBadgeAttentionSync />;
}

export function AppWindowSync() {
  const { canEnterApp, dataOwnerId } = useAuth();
  if (!canEnterApp || !dataOwnerId || isSidebarWindow()) return null;
  return <ReadyAppWindowSync />;
}
