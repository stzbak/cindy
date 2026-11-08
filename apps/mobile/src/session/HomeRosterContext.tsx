import { createContext, useContext, type ReactNode } from 'react';
import { useTeammateRoster } from './useTeammateRoster';
import { useBotGroupRoster } from './useBotGroupRoster';
import { Platform } from 'react-native';
import { isCompanionsEnabled } from '@/config/personalProfile';

const RosterContext = createContext<{
  roster: ReturnType<typeof useTeammateRoster>; groups: ReturnType<typeof useBotGroupRoster>;
} | null>(null);

/** One teammate and group-chat roster for the home, read while the home is in front. */
export function HomeRosterProvider({ children }: { children: ReactNode }) {
  const companionsEnabled = isCompanionsEnabled(Platform.OS);
  return <HomeRosterContent enabled={companionsEnabled}>{children}</HomeRosterContent>;
}

function HomeRosterContent({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const roster = useTeammateRoster(enabled);
  const groups = useBotGroupRoster(enabled ? roster.groupTargets : [], enabled);
  return <RosterContext.Provider value={{ roster, groups }}>{children}</RosterContext.Provider>;
}
export const useHomeRoster = () => useContext(RosterContext);
