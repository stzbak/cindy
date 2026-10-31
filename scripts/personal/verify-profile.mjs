#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const commands = [
  ['git', ['diff', '--check']],
  [process.execPath, ['scripts/personal/check-patch-boundary.mjs']],
  [pnpm, ['--filter', 'mobile', 'run', 'typecheck']],
  [pnpm, ['--filter', 'desktop', 'run', 'typecheck']],
  [pnpm, ['--filter', 'desktop', 'exec', 'vitest', 'run',
    'src/renderer/features/bots/__tests__/BotTaskOwnerChip.test.tsx',
    'src/renderer/features/bots/__tests__/botStore.lifecycle.test.ts',
    'src/renderer/features/cc-agent/sidebar/__tests__/SidebarFilterPopover.test.tsx',
    'src/renderer/__tests__/useSidebarFilter.test.ts',
    'src/renderer/voice-input/__tests__/personalProfile.test.ts',
    'src/renderer/voice-input/__tests__/useVoiceInput.startup.test.ts',
    'src/renderer/__tests__/askUserQuestionVoice.test.tsx',
    'src/main/__tests__/personalAppUpdate.test.ts',
    'src/main/sidebar-tab-window/__tests__/controller.test.ts',
    'src/main/remote-desktop-viewer/__tests__/windows.test.ts',
    'src/main/routines/__tests__/service.test.ts',
    'src/main/scheduler-host/__tests__/schedulerQueueWiring.test.ts',
    'src/main/im/__tests__/startupDefaultRouteBackfill.test.ts',
    'src/main/voice-input/__tests__/globalShortcut.test.ts',
    'src/renderer/components/settings/__tests__/SettingsViewEscape.test.tsx',
    'src/main/__tests__/manifestService.test.ts',
    'src/main/__tests__/updateService.test.ts',
    '--maxWorkers=1']],
  [pnpm, ['--filter', 'mobile', 'exec', 'vitest', 'run',
    'src/__tests__/personalProfile.test.ts',
    'src/__tests__/mobileVoicePrewarm.test.ts',
    'src/__tests__/mobileRealtimeAudio.test.ts',
    'src/__tests__/InteractionPanelReceipt.test.tsx',
    'src/__tests__/mobileTapdb.test.ts',
    'src/update/bundleUpdate.test.ts',
    'src/update/fetchLatestRelease.test.ts',
    'src/update/fetchPersonalLatestRelease.test.ts',
    'src/__tests__/pushRegistrationModel.test.ts',
    'src/__tests__/readTeammateTasks.test.ts',
    'src/__tests__/useTeammateRoster.test.tsx',
    'src/__tests__/HomeTeammatesSection.test.tsx',
    'src/__tests__/homeChromeMenusAndroid.test.ts',
    'src/__tests__/homeChromeMenus.test.ts']],
  [pnpm, ['--filter', '@cindy/mcps', 'exec', 'vitest', 'run',
    'src/__tests__/lizi_xdtHelperMcpServer.test.ts']],
];

for (const [command, args] of commands) {
  process.stdout.write('\n[personal] ' + command + ' ' + args.join(' ') + '\n');
  const result = spawnSync(command, args, { cwd: process.cwd(), env: process.env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
