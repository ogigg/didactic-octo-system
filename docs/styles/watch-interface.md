# Apple Watch Interface

> **Document status:** Current standard
> **Purpose:** Keep workout actions readable and consistently positioned on small Apple Watch screens.
> **Last reviewed:** 2026-09-24

## Screen structure

The native companion lives in `apps/mobile/targets/watch`. `WatchScreen` owns
the shared toolbar, title row, content margins, and primary action placement.
Individual screens supply content instead of duplicating navigation rows. The
system owns the time-of-day clock.

- `ContentView` hosts screens in a `NavigationStack` so back and details sit in
  the system toolbar corners (`topBarLeading` / `topBarTrailing`) level with
  the clock instead of in a separate header row.
- Do not set a system navigation title. With both corner controls present,
  watchOS centers the clock and squeezes the title into a narrow marquee slot.
  `WatchScreen` draws the title as a full-width first content row instead.
- The primary action ignores the bottom safe area and sits `bottomInset`
  above the screen edge.
- The trailing toolbar control opens details. It stays a quiet `ellipsis` while
  everything is synchronized and only turns into a gold sync or warning glyph
  when changes are waiting, the phone is unreachable, or Apple Health failed.
- Use the shared horizontal margin and primary-action sizing from `WatchLayout`.
- Keep the active set, rest timer, heart rate, and exercise completion usable
  without vertical scrolling at the default text size on the 40 mm SE.
- Allow deliberate scrolling for larger text sizes, exercise browsing,
  set history, notes, and connection details. Do not shrink all text to make a
  dense screen fit.
- Keep exercise names to a bounded title region. Full names and prescriptions
  remain available in details and accessibility labels.
- Put the main action in the shell's bottom region. Long titles must not push
  it below the visible screen.
- Show warmup and working-set labels distinctly. Session warmup completion is
  available from the exercise list.

## Visual language

- The background is pure black so the app blends into the bezel. Each screen
  adds a soft `AmbientGlow` behind the header in its purpose color: sky blue
  for logging and rest, green for completion, red for heart rate.
- Tokens live in `WatchTheme` (`WorkoutWatchApp.swift`) and sizes in
  `WatchLayout`. Cards and rows use the round `cardRadius`; data wells, set
  rows, and stat strips use the tighter `dataRadius`.
- The Digital Crown target is the one sky-blue outlined well with a
  `chevron.up.chevron.down` hint; other wells stay neutral. A running timed
  set turns its well and the screen glow green.
- `SetProgressBar` shows one segment per set: green when done, glowing sky blue
  for the current set, neutral for the rest.
- The primary capsule carries a leading SF Symbol. Use green for starting a
  timer, moving on, and finishing; use a neutral surface capsule for skipping.
- Keep destructive actions out of the primary slot during an active workout.
  The exercise list's primary action continues the current exercise, starts
  the next one, or finishes when every set is done. **End workout** sits as a
  red text button at the end of the list.
- Rest is a countdown ring. Tapping the ring pauses or resumes, rest-adjust
  buttons flank it (the synced watch-settings step, 15 s by default), and the
  line underneath shows live heart rate and the next set.
- Completion screens summarize duration, completed sets, and volume.

## Workout interactions

The active screen edits reps and load, or duration for a timed exercise. The
Digital Crown changes the focused value. Targets and previous performance are
available in details alongside completed sets, which can be reopened for
correction. Rest supports pause, resume, adjustment, skipping, and undoing the
last completed set. Destructive actions use dismissible system confirmations.

Connection information describes whether changes are saved locally and waiting
for the phone, being sent, or synchronized. It does not expose protocol or
revision details. Health tracking failures have a retry action.

## Layout verification

Use the 40 mm SE 2 as the compact baseline, then check the 44 mm model. Verify
English and Polish, long exercise names, multi-digit loads and heart rates,
missing heart rate, timed exercises, paused rest, completed workouts, and larger
accessibility text. Check the back button and primary action across successive
screens, not only each screen in isolation.

Debug builds accept `--watch-preview` followed by `active`, `timed`, `rest`,
`heartRate`, `exerciseComplete`, `list`, `details`, `waiting`, or `complete`.
Add `--large-text` to verify enlarged text with the same fixtures.
These deterministic fixtures do not send commands, start HealthKit, overwrite
persisted workouts, or accept snapshots from the paired phone. They are excluded from Release builds.

For local commands and the physical-device connection checks, see the
[mobile README](../../apps/mobile/README.md#apple-watch-companion).
