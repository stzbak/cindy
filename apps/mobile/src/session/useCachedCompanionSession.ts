import { useEffect, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { getMobileAuthOwner, isMobileAuthOwnerCurrent } from '@/auth/authOwnerGeneration';
import { useRevokedDevices } from '@/device-link/revokedDevicesStore';
import { isCompanionsEnabled } from '@/config/personalProfile';
import { cachedBotIdForSession, cachedBotItem, readRemoteResourceSnapshot,
  remoteResourceCacheRevision, subscribeRemoteResourceCache } from '@/device-link/remoteResourceCache';

/** An exact saved conversation link supplies presentation, never dispatch authority. */
export function useCachedCompanionSession(deviceId: string, sessionId: string) {
  const companionsEnabled = isCompanionsEnabled(Platform.OS);
  const { user, accountGeneration } = useAuth();
  const owner = getMobileAuthOwner();
  const revoked = useRevokedDevices();
  useSyncExternalStore(subscribeRemoteResourceCache, remoteResourceCacheRevision);
  useEffect(() => {
    if (companionsEnabled && user?.id && isMobileAuthOwnerCurrent(owner)) void readRemoteResourceSnapshot(user.id);
  }, [companionsEnabled, user?.id, accountGeneration]);
  if (!companionsEnabled || !user?.id || !isMobileAuthOwnerCurrent(owner) || owner.accountId !== user.id || !deviceId || !sessionId || revoked.has(deviceId)) return null;
  const botId = cachedBotIdForSession(user.id, 'teammates', deviceId, sessionId);
  return botId ? cachedBotItem(user.id, 'teammates', deviceId, botId) : null;
}
