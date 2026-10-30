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
    '--maxWorkers=1']],
  [pnpm, ['--filter', 'mobile', 'exec', 'vitest', 'run',
    'src/__tests__/personalProfile.test.ts',
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
