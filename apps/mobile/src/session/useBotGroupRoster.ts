import { useChatServerRoster } from '@/chat/useChatServer';
import { BOT_GROUP_REMOTE_COLLECTION_ID, BOT_GROUP_REMOTE_RESOURCE_KIND } from '@cindy/maker-shared/botGroupChat';
import { useRevokedDevices } from '@/device-link/revokedDevicesStore';
import type { RemoteResourceHostTarget } from '@/device-link/remoteResources';
import { useRemoteResourceList } from './useRemoteResourceList';
import { Platform } from 'react-native';
import { isCompanionsEnabled } from '@/config/personalProfile';

const NO_TARGETS: RemoteResourceHostTarget[] = [];

/**
 * Server memberships are primary; advertised computer collections preserve legacy access.
 */
export function useBotGroupRoster(targets: readonly RemoteResourceHostTarget[], enabled: boolean) {
  const active = enabled && isCompanionsEnabled(Platform.OS);
  const server = useChatServerRoster(active);
  const revoked = useRevokedDevices();
  const hosts = targets.length ? targets : NO_TARGETS;
  const list = useRemoteResourceList(BOT_GROUP_REMOTE_COLLECTION_ID, hosts, active && hosts.length > 0);
  // A removed server membership must not reappear through a stale computer cache.
  const seen = new Set(server.serverIds);
  // Old cached rows carry no server/local discriminator. Only a current-epoch
  // authenticated collection reply can authorize the compatibility projection.
  const legacy = list.items.filter((row) => {
    const id = row.item.ref.id;
    if (row.item.ref.kind !== BOT_GROUP_REMOTE_RESOURCE_KIND || !list.isOnline(row.host) || seen.has(id)
      || revoked.has(row.host.deviceId) || !hosts.some((host) => host.deviceId === row.host.deviceId)) return false;
    seen.add(id);
    return true;
  });
  return {
    items: active ? [...server.items, ...legacy] : [],
    loading: active && (server.loading || (hosts.length > 0 && list.loading)),
    refreshing: active && (server.refreshing || list.refreshing),
    error: active ? server.error ?? (hosts.length ? list.error : null) : null,
    /** Server membership discovery needs no supporting computer. */
    supported: active,
    isOnline: (host: RemoteResourceHostTarget) => active && (!host.deviceId || (!revoked.has(host.deviceId) && list.isOnline(host))),
    refresh: async () => { if (active) await Promise.all([server.refresh(), ...(hosts.length ? [list.refresh()] : [])]); },
  };
}
