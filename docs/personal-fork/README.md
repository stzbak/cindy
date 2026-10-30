# Cindy Personal fork profile

This fork keeps upstream behavior available while applying narrow platform gates for the personal client.

## Composer voice input

- `apps/desktop/src/shared/personalProfile.ts` disables composer dictation on Windows.
- `apps/mobile/src/config/personalProfile.ts` disables composer dictation on Android.
- The gate covers the main composer and the question-card answer fields. It also prevents their long-press and keyboard startup paths from opening the microphone or warming ASR.
- Linux desktop and iOS retain upstream voice input. Audio attachments and other audio consumers remain unchanged.
- The Android explicit E2E mock-audio flag remains available for automated voice tests.

When syncing upstream, fetch official `main` and rebase `personal` onto it. Keep these two profile modules as the only platform-policy files and apply upstream component changes around their call sites.

## Companion entrypoints and runtime

- Windows keeps the companion database, historical sessions, shared protocol types, and ordinary Agent/MCP/device-link features. The personal profile hides the companion navigation, settings, delegation targets, call controls, and old `/bots/*` deep links, while stopping companion autonomy, companion-owned IM connections, group/cloud hosts, routine dispatch, and companion-only tools.
- Android keeps ordinary tasks, remote control, notifications, attachments, automation, and the protected MCP surface. The personal profile hides the home companion section and companion filters, redirects old companion routes, disables companion task reads and Chat Server polling, and ignores companion group notification targets. Ordinary task notifications and `/sessions/*` links remain active.
- Linux desktop and iOS continue to use upstream behavior. Database tables, migrations, persisted rows, shared components, and server contracts stay in place so this fork can track upstream releases with small call-site patches.

The intended boundary is: hide every personal-client entry point, stop background work that would otherwise consume resources or contact companion services, and leave inert code and persisted data intact.

When updating upstream, prefer adding checks through the two `personalProfile` modules and keep feature gates near existing composition points. Avoid deleting schema, migrations, protocol types, or shared feature modules unless the platform behavior itself changes.

## Upstream tracking model

The official repository at `https://github.com/makecindy/cindy` is the source of truth. The `personal` branch is expected to contain a small commit stack on top of official `main`; it must not accumulate unrelated merges, generated native projects, or local build files.

GitHub only schedules workflows and exposes manual dispatch when the workflow exists on the repository default branch. Set the fork default branch to `personal` after this patch is pushed; the daily schedule and `workflow_dispatch` become available then.

The daily workflow `.github/workflows/personal-upstream.yml` runs at 23:45 UTC (07:45 Singapore time) and performs this sequence:

1. Fetch official `main`.
2. Rebase the Personal commit stack onto the fetched commit.
3. Push the result to the isolated `automation/upstream-sync-staging` branch.
4. Run typechecks, profile tests, an unsigned Windows package build, and a signed Android APK build.
5. Move the verified commit to `automation/upstream-sync` and open or update a draft PR into `personal` only after those checks pass.
6. Leave review and merge to the owner. The workflow never promotes or merges the branch automatically.

A conflict aborts the rebase and restores the original `personal` HEAD. The workflow records the conflicting files and opens or updates the single automation-failure issue. A build failure has the same visible failure path, so a branch that did not compile cannot be presented as the next Personal release.

Local commands:

- `pnpm personal:sync-upstream` rebases the current clean `personal` branch onto official `main`.
- `pnpm personal:test-sync` tests the rebase, conflict-abort, up-to-date, and dirty-tree paths in temporary repositories.
- `pnpm personal:verify` runs the platform typechecks and the focused companion/voice/MCP regression suite used by the automation.

The workflow uses these repository secrets:

- `PERSONAL_AUTOMATION_TOKEN`: a fine-grained GitHub token used to create the draft PR. This token is required because PRs created with the workflow's built-in token do not trigger the normal PR CI workflow.
- `PERSONAL_MOBILE_CONFIG_JSON`: the full JSON content of `apps/mobile/scripts/self-host-regions.json`, including the CN package identity, TapDB values, and Android signing alias.
- `PERSONAL_ANDROID_KEYSTORE_BASE64`: the Android signing keystore encoded as base64.
- `XDT_ANDROID_KEYSTORE_PASSWORD_CN`: the Android keystore password.
- `XDT_ANDROID_KEY_PASSWORD_CN`: the Android key password.
- `CINDY_WIN_SIGN_CMD` (optional): the external Windows signing command. Without it, the workflow still compiles an unsigned installer for validation.

The Android package id and signing key, and the Windows publisher identity, must remain compatible with existing Personal installations. Changing either identity creates a different app and prevents normal updates.

The workflow currently builds validation artifacts. Publishing them to a Personal update feed remains a separate, explicit release action so an upstream sync cannot silently replace the running client.

## Patch maintenance rules

- Put platform policy in `apps/desktop/src/shared/personalProfile.ts` and `apps/mobile/src/config/personalProfile.ts`.
- Keep call-site gates close to existing composition, navigation, store, and IPC boundaries.
- Keep Linux desktop and iOS on upstream behavior.
- Do not remove database tables, migrations, protocol types, signing, authentication, update code, or shared service contracts for an entry-point hide.
- Prefer a runtime gate over deleting a component when the component is inert and has no startup or background cost.
- Add a focused regression test whenever a gate stops network polling, task execution, audio capture, notification delivery, or a deep link.
- Do not edit generated `android/` or `ios/` projects. Recreate them from Expo prebuild during a build.
- Do not commit credentials, keystores, `self-host-regions.json`, endpoint overrides, build artifacts, or workflow result files.

When upstream moves a call site, resolve the conflict by restoring the upstream file and reapplying the smallest gate that preserves the tested behavior. If a protected feature is about to be blocked, stop the sync and fix the gate boundary before merging.

## Protected-path guard

The automation compares the candidate with the fetched official commit before running the platform tests. `scripts/personal/check-patch-boundary.mjs` rejects Personal changes to dependency lockfiles, database migrations and local database code, updater implementations, packaging and signing configuration, service endpoint files, generated native projects, release tooling, credentials, and shared packages other than the existing `packages/lizi-mcps` compatibility gate.

The guard is intentionally strict. If a future change genuinely needs to cross one of these boundaries, update the guard and its tests in the same reviewed commit instead of bypassing the failure.

`PERSONAL_AUTOMATION_TOKEN` should be a fine-grained token limited to `stzbak/cindy` with repository contents read/write and pull-request read/write access. Store it as an Actions secret. The other Android secrets contain credentials or signing material and must never be committed or pasted into build logs.
