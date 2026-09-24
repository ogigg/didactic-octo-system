# Apple Watch Interface

> **Document status:** Current standard
> **Purpose:** Keep workout actions readable and consistently positioned on small Apple Watch screens.
> **Last reviewed:** 2026-09-07

## Screen structure

The native companion lives in `apps/mobile/targets/watch`. `WatchScreen` owns
the shared header, content margins, and primary action placement. Individual
screens supply content instead of duplicating navigation rows. The system
owns the time-of-day clock; application content respects its safe area.

- Use the same leading back-button position and trailing control region across
  screens. Reserve their space when a control is absent.
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
These deterministic fixtures do not send commands, start HealthKit, or overwrite
persisted workouts. They are excluded from Release builds.

For local commands and the physical-device connection checks, see the
[mobile README](../../apps/mobile/README.md#apple-watch-companion).
