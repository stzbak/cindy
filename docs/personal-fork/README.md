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

## Windows resident resource reductions

- Resource monitor, remote desktop viewer, sidebar pop-outs and the global voice overlay are created on demand. Startup prewarm and unused spare replenishment are disabled only on Windows. Existing ready/presented handshakes, permissions, reuse and recovery remain; the first open can take longer. This is the owner's explicit Personal exception to the upstream auxiliary-window prewarm baseline.
- Personal IM bots and official Hook chat ingress are hidden from settings (including old deep links), with IPC registration, orchestrator setup and account connection disabled. Independent enterprise WeChat/ntfy notifications, ordinary task notifications, scheduler and device-link remain available. Saved IM credentials and histories stay intact.
- Companion routine startup does not create an engine or a one-second tick timer, including lazy callers. A one-shot owner-scoped compatibility pass pauses backing schedules for saved routines without rewriting or deleting their rules/history. Ordinary schedules are unaffected.
- macOS and Linux retain upstream behavior. These gates reduce runtime work; they do not remove bundled SDKs or claim a measured installer-size or memory saving.

## Weekly upstream tracking and stable publication

GitHub Actions runs `personal-upstream.yml` each **Saturday at 07:45
Asia/Singapore** (Friday 23:45 UTC; cron `45 23 * * 5`). The default branch is
`personal`. GitHub may delay scheduled starts; manual dispatch remains available.

1. Fetch official main and rebase the small Personal commit stack.
2. Put changes on isolated `automation/upstream-sync-staging`. A conflict aborts
   the rebase and reports an issue without changing Personal or the latest release.
3. Explicitly dispatch the unified `personal-release.yml` pipeline, because
   built-in token pushes do not trigger ordinary push workflows.
4. Pin the source SHA, current public official Windows/Android versions, and an
   internal build sequence. If source and both versions match the complete latest
   release, stop successfully without rebuilding.
5. Run boundary checks, typechecks, focused regressions, Windows CN installer and
   hotfix packaging, and signed Android CN APK packaging. All must succeed.
6. For rebased candidates, atomically back up the old Personal HEAD to
   `automation/personal-backup-<run_id>` and promote using an exact
   `--force-with-lease`. Concurrent Personal changes stop promotion. Direct
   Personal builds refuse publication if Personal moved during the build.
7. Upload both platforms, metadata and SHA256SUMS to a draft Release, then mark
   the complete release stable/latest. Published releases are immutable. Failure
   reports retain the previous complete stable release.

Automatic promotion and publication are owner-authorized. There is no routine
manual-merge gate. If publication fails after promotion, the prior branch state is
in the backup ref and the old stable release remains live; fix and dispatch again.
Actions uses the repository-scoped built-in token, with contents/actions/issues
permissions as required. No personal access token or external scheduler is needed.
GitHub may disable schedules on inactive public forks; check Actions if no weekly
run appears. Failures create GitHub issues; delivery depends on GitHub notification
settings.

### Versions, source identity and update feeds

Displayed versions come from the public official CN feeds in `config/endpoint.json`.
Windows and Android have separate official version series. The internal build is
`200000 + personal-release run_number`; Android uses it as versionCode and Windows
embeds it for same-version rebuilds. Release tags include both versions and run.

The source stack tracks official **main**, which can be ahead of official release
tags. Matching displayed versions does not mean identical official-release source.
Each release records the actual source SHA. Do not reset this fork to an older tag
merely to match the displayed version.

Windows replaces only the application manifest with `cindy-personal-windows.json`
from `stzbak/cindy/releases/latest`. Claude Code, Codex, Pi and other binary
metadata/download bases remain official. If GitHub fails, application updating
fails closed while official engine metadata remains available. Application assets
must belong to the same release and pass SHA256 checks. Native updater, busy-task
confirmation, rollback and platform safety paths remain. Linux and iOS keep
upstream update behavior. Windows uses the supported `--no-sign` build path:
**no Authenticode certificate is configured**, so Windows trust prompts can remain.
Windows side-by-side installation with official Cindy has not been implemented.

Android package `com.stzbak.cindy` coexists with official `com.xd.cindycn` and
keeps its existing Personal signing key. Full APK updates use Personal GitHub
latest; official JS OTA is disabled. Packaging validates package, versionName,
versionCode, source and runtime fingerprint. TapDB remains disabled because
official credentials are package/signature-bound. The official `cindycn` OAuth
scheme remains; external callback selection with both apps installed still needs
real-device validation.

The old Windows 0.0.0 installer and Android 1.0.2 test client require **one manual
in-place installation** of the first stable release. Subsequent releases use their
Personal feeds. Do not uninstall Android or change its signing key for migration.
Real-device install/replace/relaunch verification is separate from CI compilation.

### Local verification and signing material

- `pnpm personal:sync-upstream` requires a clean Personal branch.
- `pnpm personal:test-sync` checks rebase/conflict recovery, boundaries and atomic
  promotion/backup in temporary repositories, including concurrent owner edits.
- `pnpm personal:verify` runs typechecks and companion, voice, update,
  notifications and protected MCP regression tests.

Existing repository secrets remain:

- `PERSONAL_MOBILE_CONFIG_JSON`: CN build/signing config; workflows override the
  Android package to `com.stzbak.cindy`.
- `PERSONAL_ANDROID_KEYSTORE_BASE64`: stable Personal Android keystore.
- `XDT_ANDROID_KEYSTORE_PASSWORD_CN` and `XDT_ANDROID_KEY_PASSWORD_CN`.

Never print, commit or regenerate existing signing material during normal updates.

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

The automation compares the candidate with the fetched official commit before running the platform tests. `scripts/personal/check-patch-boundary.mjs` rejects Personal changes to dependency lockfiles, database migrations and local database code, general updater implementations, packaging and signing configuration, service endpoint files, generated native projects, release tooling, credentials, and shared packages other than the existing `packages/lizi-mcps` compatibility gate. Updater allowlists cover only reviewed Personal feeds/build-number comparison files and the explicit Personal Windows packaging flag. Native updaters and signing configuration remain protected.

The guard is intentionally strict. If a future change genuinely needs to cross one of these boundaries, update the guard and its tests in the same reviewed commit instead of bypassing the failure.

Workflow permissions are scoped to this fork. CI validates the pinned candidate
before promotion/publication. Signing material and private build configuration
must never appear in source, release assets or logs.
