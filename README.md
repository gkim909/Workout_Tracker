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
