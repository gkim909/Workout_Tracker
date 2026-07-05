# FitTrack - Premium Workout Tracker

A progressive web app (PWA) for tracking workouts.

## Features
- **Offline First:** Works without an internet connection.
- **Local Storage:** Data stays on your device (IndexedDB).
- **Private:** No data is sent to the cloud, ensuring complete privacy.
- **Installable:** Add to home screen on iOS and Android.
- **Analytics:** Visualize your progress with charts.
- **Running Tracker:** Log distance and time (h:m:s), see your pace (min/mi) trend on the dashboard, and runs count toward your workout streak.
- **Mobile-First:** Optimized for iPhone and touch-only use (no keyboard shortcuts).

## How to Use
1. Visit the hosted URL (e.g., on GitHub Pages).
2. Tap "Share" -> "Add to Home Screen" on iOS.
3. Open the app and start logging!

## Version History
- **v1.34.1**: Native feel pass — restored iOS rubber-band overscroll in the native app (Capacitor disables it by default; re-enabled via a `CAPBridgeViewController` subclass) with the overscroll area painted in the theme color and light status-bar glyphs; page content now pads below the Dynamic Island/notch (`env(safe-area-inset-top)` on the container — needed since `viewport-fit=cover`); floating bottom nav raised (10→18px) and slightly bigger (52px buttons, larger icons/labels), with matching bottom clearance.
- **v1.34**: FitTrack now also ships as a native iOS app (Capacitor wrap, separate `FitTrack-Native` repo) with **automatic backups**: every data change silently writes a date-stamped JSON to the Files app (On My iPhone → FitTrack, newest 30 days kept, plus a timestamped safety file before Clear All Data) — no reminder banner, no share sheet. In the browser/PWA all native code is inert and backups work exactly as before. Shared changes in this version: double-tap-to-zoom is disabled (`touch-action: manipulation` + viewport cap), and fonts/icons/Chart.js are now vendored locally in `vendor/` (no more CDN dependencies — charts and icons work fully offline; the app icon is served locally too).
- **v1.33.2**: Log Workout date is now a compact box instead of a full-width bar (matching Log Running), and the daily backup reminder banner now shows every time the app opens or returns to the foreground on a day with no backup — only the ✕ silences it, and only until the next day (previously it appeared once per day even if never dismissed, and iOS resume-from-memory often skipped it entirely).
- **v1.33**: Log Running layout refinement: Date and Distance share one row (shorter date bar), the h:m:s time box is full width, and distance/time digits are larger and easier to read; removed the distance +/- steppers (typed once per run).
- **v1.32**: Mobile UI pass: slimmer bottom nav with four even, single-line tabs (Dashboard / Workout / Running / Settings) and reduced height, and a compact Log Running form — Distance and Time (h:m:s) now sit side by side with a slim inline Pace readout instead of a large box.
- **v1.31**: Backup files are now date-stamped (e.g. `fittrack-backup-2026-07-05.json`) — iOS won't let a web app overwrite files in the Files app, so a fixed name silently piled up "name 2" copies; the date cap means at most one backup file per day and old dates are easy to spot and delete. The Settings filename field now takes just the base name, with a live preview of today's full filename.
- **v1.30**: Run time is now entered in a single hours : minutes : seconds box (steppers removed — it's typed once per run), runs over an hour display as h:mm:ss, and the pace preview/math accounts for hours.
- **v1.29**: Added a Running Tracker: a new "Log Running" tab (distance + minutes/seconds steppers with a live min/mi pace preview, and a Last 5 Runs list), a dashboard "Running Pace" graph charting average pace per day (lower = faster) with distance/time tooltips, runs mixed into Recent History under their date, and run days counting toward Workout Streak and Last Workout. Runs are included in backups, import/export, snapshots, and Clear All Data, and Settings statistics now show total runs and miles.
- **v1.28**: Backup reminder banner now sticks to the top of the screen while scrolling (with a blur backdrop and slide-in animation) and only appears on the first open of a day that has no backup yet — dismissing it with the ✕ keeps it hidden until the next day.
- **v1.27**: Added per-set & session notes (with inline history views), a Recent History 7/30-day filter, supersets now logged as regular sets (counted in averages) with a partner-stats bullet, swapped Reps/Weight input positions, and new Backup tools (one-tap share-sheet export with a fixed filename, a daily reminder banner, and an on-device snapshot + restore). Hardened the iOS home-screen PWA against stale-cache/refresh-crash issues: versioned service-worker cache with old-cache cleanup, `skipWaiting`/`clients.claim`, a network-first app shell, versioned manifest/icon references, and a "Reset app cache" tool in Settings. Added Settings tools to rename an exercise across all records (with merge) and a simple statistics breakdown (sets per exercise, sessions, and totals). Reduced the theme set to Glacial Flux and Ballerina (retired Neumorphism and Pixel Art, with automatic migration of saved themes), fixed a crash in "Clear All Data" (undeclared `intensityChartInstance`), and removed dead code/CSS.
- **v1.26**: Renamed Glassmorphism to Glacial Flux and updated the palette.
- **v1.25**: Added a dropdown for superset exercise selection, updated superset labels, and refined Ballerina dropdown styling.
- **v1.24**: Refined Neumorphism controls, increased Glassmorphism nav translucency, and added the Ballerina theme.
- **v1.23**: Replaced the top tab navigation with a floating mobile bottom nav and moved UI style selection into Settings.
- **v1.22**: Added optional two-exercise superset logging with linked history display.
- **v1.21**: Added intensity values to the quick exercise history in the Log Workout tab.
- **v1.2**: Added Exercise Reset button and automatic set renumbering after deletions.
- **v1.1**: Replaced "Avg Intensity" text with thematic Flame icons throughout the UI.
- **v1.091**: Refined Intensity UI (colored text, full labels) and added Daily Average to Log tab.
- **v1.09**: Replaced Intensity Graph with Calendar View, standardized UI with colored intensity badges.
- **v1.08**: Added Intensity Analytics (Graph & Averages), improved set ordering (newest on top), and enabled deletion in Log tab.
- **v1.07**: Optimized UI for mobile devices with horizontal scrolling menu and better spacing.
- **v1.06**: Added Settings tab with improved UI and Bulk Delete options.
- **v1.05**: Updated Exercise History to only show workouts from previous dates.
- **v1.05**: Updated Exercise History to only show workouts from previous dates.
- **v1.04**: Migrated storage to IndexedDB for better performance and scalability.
- **v1.03**: Enhanced Log Workout tab with Today's History, Exercise History, and fixed Set Indicator.
- **v1.02**: Implemented tabbed interface for better navigation.
- **v1.01**: Added streak tracking (Current & Longest) and optimized mobile UI.
- **v1**: Initial version with version tracking added.
