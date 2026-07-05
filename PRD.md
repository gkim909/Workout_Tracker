# PRD — FitTrack native app (parallel to the PWA) & automatic local backups

**Owner:** Glen Kim · **Repo:** `~/Desktop/Github/Workout_Tracker` · **Created:** 2026-07-04

> **Resuming in a new session?** Read this file top to bottom, then check
> "Milestones" for current status. The live PWA is
> https://gkim909.github.io/Workout_Tracker/ (GitHub Pages — deploying = push
> to `main` + bump `APP_VERSION`). The native version lives in a **separate
> folder**: `~/Desktop/Claudious/fittrack-native` — its `README.md` is the
> step-by-step build/install/update guide.

## 1. Problem & goal

FitTrack holds months of workout and running history on Glen's iPhone. Goals,
as decided by Glen on 2026-07-04:

1. **A native standalone app**, like the receipt scanner
   (`~/Desktop/Claudious/receipt-scanner`), built as a **separate project in
   its own folder** — the GitHub-hosted PWA stays untouched and remains the
   daily driver until the native app proves itself.
2. **Automatic daily backups saved locally to the Files app** — no cloud, no
   GitHub, no taps. (Explicitly rejected: auto-backup to a private GitHub
   repo.)
3. A clear path from today's free-account install to a **TestFlight** install
   later, plus a guide for how updates get pushed in each phase.

## 2. Background — facts that shape the plan

- **Current state (v1.33.2):** vanilla-JS PWA (~2,300 lines `app.js`), data in
  IndexedDB, installed on the home screen, served from GitHub Pages. Backup =
  manual: banner → tap → share sheet → date-stamped JSON into Files.
- **Why backups can't be automatic in the PWA:** iOS never lets a web app
  write a file silently — every save goes through the share sheet or a
  download prompt. Writing silently to the app's own folder in Files requires
  a native app. That is the concrete thing going native buys here.
- **Receipt-scanner precedent:** native Expo app, built in Xcode, installed
  over cable (`npm run ios:device`).
- **Glen's Apple account is a free "Personal Team"** (verified: profile team
  "Glen Kim", created 2026-07-04, expires 2026-07-12). Free-account
  consequences, accepted by Glen for now:
  - A native app installed from the Mac **stops launching after 7 days**
    until rebuilt over cable (data survives; the app just won't open).
    The receipt scanner hits this ~2026-07-11.
  - No TestFlight until the $99/yr Apple Developer membership; buying it
    later upgrades both apps to 1-year/OTA installs.
- **iOS gives apps essentially no background time**, native or web. Backups
  run whenever the app is opened or data is saved — which is exactly when the
  data changes, so every workout is covered. "Daily" = every day the app is
  used produces that day's backup file.

## 3. Non-negotiable principles

1. **The PWA stays untouched in behavior.** Same URL, same manual backup
   flow, same `git push` updates. It is the fallback while the native app is
   on 7-day signing.
2. **One source of truth for app code.** The native project *wraps* the files
   in this repo (copied in by a sync script); features are never written
   twice. Native-only behavior (auto-backup, no service worker) is added
   behind "am I running natively?" guards that are inert in the PWA.
3. **Backups are silent, automatic, and local.** Dated JSON files appear in
   the Files app (On My iPhone → FitTrack) with zero taps. No cloud services.
4. **Manual export stays** in both versions as an escape hatch.
5. **The data survives app trouble:** files in the app's Documents folder are
   included in the phone's normal iCloud/iTunes device backup, can be copied
   anywhere from the Files app, and survive the 7-day signing expiry.
   (Honest limit: deleting the app itself deletes its Documents folder —
   copy a backup out of Files first, or restore from device backup.)

## 4. Architecture — two apps, one codebase

```
~/Desktop/Github/Workout_Tracker        ← this repo: the code + the PWA
   index.html / app.js / db.js / style.css / service-worker.js
        │
        │  git push               → GitHub Pages → home-screen PWA (unchanged)
        │
        │  scripts/sync-web.sh    → copies web files into the native project
        ▼
~/Desktop/Claudious/fittrack-native     ← separate folder: Capacitor iOS wrap
   www/ (copied web files) + ios/ (Xcode project)
        │
        │  Xcode ▸ Run (cable)    → native FitTrack on the iPhone  (now)
        │  Xcode ▸ Archive        → TestFlight over-the-air        (after $99)
        ▼
   iPhone: native app + silent daily backups in Files
```

- **Wrapper: Capacitor** (not Expo/React Native). The receipt scanner needed
  RN because it was written from scratch; FitTrack already exists as web
  code, and Capacitor ships exactly those files inside a native shell with a
  filesystem bridge — no rewrite, no framework.
- The two apps have **separate data stores**. One-time migration: export JSON
  from the PWA → import in the native app. Until Glen switches daily drivers,
  whichever app he logs in holds that entry — don't log in both.

## 5. Decisions log

| Date | Decision | Why |
|---|---|---|
| 2026-07-04 | Keep vanilla-JS app; no rewrite, no framework | Proven through 30+ versions |
| 2026-07-04 | **No cloud/GitHub backups — local files in the Files app only** (Glen) | Glen's preference; native shell makes silent local writes possible |
| 2026-07-04 | **PWA untouched; native app is a separate parallel project in its own folder** (Glen) | PWA remains the safe daily driver; native starts as a pilot on free 7-day signing |
| 2026-07-04 | Native now on the free account, **TestFlight upgrade later** (Glen) | Accepts weekly cable re-install short-term; $99/yr later removes it |
| 2026-07-04 | Native wrap = **Capacitor**, web files copied from this repo by a sync script; native-only code behind runtime guards | One codebase, features written once, PWA behavior identical |
| 2026-07-04 | Native project gets **its own private GitHub repo** (`gkim909/FitTrack-Native`), with the synced `www/` snapshot committed (Glen) | Separate version history per app; repo is self-contained and records exactly which web version each native build shipped; this repo stays public only because GitHub Pages requires it |
| 2026-07-04 | Backup trigger = "whenever data changes", not a clock | iOS gives no background time; data only changes while the app is open |

## 6. Automatic local backup design (native app only)

- **Trigger:** after every saved workout / run / note (debounced a few
  seconds), and on every app open / return-to-foreground if data changed
  since the last successful write.
- **Destination:** the app's Documents folder via Capacitor's Filesystem
  plugin → visible in **Files → On My iPhone → FitTrack** (requires
  `UIFileSharingEnabled` + `LSSupportsOpeningDocumentsInPlace` in Info.plist).
- **Files:** `fittrack-backup-YYYY-MM-DD.json` — one per day, overwritten
  within the day (same date-stamped convention as today's manual export).
  Auto-prune to the newest ~30 so the folder never silts up.
- **Payload:** the existing export format (`buildExportPayload()`), so any
  backup file works with the existing Import button in either version.
- **UI:** Settings shows "Last backed up: today 9:14 AM ✓ → Files/FitTrack".
  The reminder banner disappears in the native app (nothing to remind — it's
  automatic) and is unchanged in the PWA.
- **In the PWA these code paths are inert** — it keeps the manual
  share-sheet backup exactly as today.

## 7. How updates get pushed

| | PWA (unchanged, today's flow) | Native, free account (now) | Native, TestFlight (after $99/yr) |
|---|---|---|---|
| Ship an update | Bump `APP_VERSION` → `git push`; phone has it on next open | `sh scripts/sync-web.sh` → `npx cap copy ios` → Xcode ▸ Run with iPhone plugged in | Same sync, then Xcode ▸ Archive → upload; phone updates over the air, no cable |
| Install lifetime | Indefinite | **7 days**, then rebuild over cable | 90 days per build (ship at least quarterly) |
| First install | Safari → Add to Home Screen | Cable + trust developer cert | TestFlight invite email |

## 8. Milestones

| # | What | Status |
|---|---|---|
| M0 | PRD, facts verified, Glen's decisions recorded; native folder + setup guide created (`~/Desktop/Claudious/fittrack-native/README.md`) | **done 2026-07-04** |
| M1 | Scaffold Capacitor project per guide Phase 1 | **done 2026-07-04** — installed and launching on the iPhone |
| M2 | Code (v1.34/v1.34.1): native guards, auto-backup engine + before-clear safety file, no-zoom fix, vendored CDN assets, app icon + `set-icon.sh`, native feel pass (rubber-band scroll, Dynamic Island inset, raised/bigger nav) | **done & deployed 2026-07-05** — 28 Playwright checks + simulator builds; live on GitHub Pages (`.nojekyll` added after a transient Pages deploy failure) |
| M3 | Rebuild to phone (▶ Run), data migration (export→import), week of side-by-side use | not started |
| M4 | *(when Glen buys the $99/yr membership)* TestFlight setup — guide Phase 6; also rescues the receipt scanner from weekly expiry | not started |

## 9. Build & run

- **PWA local test:** any static server from this repo's root
  (`python3 -m http.server 8000`) → http://localhost:8000.
- **PWA deploy:** bump `APP_VERSION` in `service-worker.js` + `?v=` refs,
  update README history, `git push`.
- **Native:** follow `~/Desktop/Claudious/fittrack-native/README.md` — it is
  the authoritative step-by-step (scaffold, signing, install, weekly
  re-sign, TestFlight upgrade).

## 10. Open items

1. ⚠️ **Receipt scanner stops launching ~2026-07-11** (free-team 7-day
   profile). Rebuild it over cable that week — same ritual the native
   FitTrack will need until TestFlight.
2. M1/M3 need Glen at the Mac with the iPhone plugged in (Xcode signing +
   trust prompts can't be automated).
