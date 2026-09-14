# Streak Protection Experience

> **Document status:** Current reference
> **Purpose:** Describe how the mobile app presents streak state, protections, and comebacks so changes stay calm, non-blocking, and consistent with the backend rules.
> **Last reviewed:** 2026-09-10

Related tickets: SWE-70, SWE-99, SWE-116, SWE-139.

## Table Of Contents

- [Scope](#scope)
- [Product Rules](#product-rules)
- [Prompt States And Surfaces](#prompt-states-and-surfaces)
- [Actions Per State](#actions-per-state)
- [Interaction Rules](#interaction-rules)
- [Copy Principles](#copy-principles)
- [Known Discrepancy: Qualifying Workouts](#known-discrepancy-qualifying-workouts)
- [Implementation Map](#implementation-map)

## Scope

Covers the Home screen streak prompt (`StreakProtectionSheet`,
`StreakStatusCard`) and the streak number shown in statistics and the workout
summary. Backend rules live in
[`20260708000000_add_streak_protection.sql`](../../../supabase/migrations/20260708000000_add_streak_protection.sql)
and are treated as the source of truth here.

## Product Rules

- A streak counts consecutive ISO weeks with at least one qualifying workout or
  a protected (frozen/restored) week.
- Free users get one lifetime restore and can earn one freeze after four
  consecutive weeks (re-earnable every 28 days). Pro users receive one freeze
  per month (max three) which is auto-applied by default.
- Restarting sets `streak_restarted_at`; only later workouts count toward the
  streak. Workout history itself is never modified.
- Dismissing a prompt snoozes that prompt state for three days server-side.

## Prompt States And Surfaces

`get_streak_status` returns `prompt_state` and `should_show_prompt`. The client
decides the surface in
[`lib/streak-prompt.ts`](../../../apps/mobile/lib/streak-prompt.ts):

| `prompt_state`         | Meaning                                            | Surface     |
| ---------------------- | -------------------------------------------------- | ----------- |
| `none`                 | Nothing to say                                     | none        |
| `at_risk`              | Streak intact, no workout for 8+ days              | inline card |
| `pro_auto_applied`     | Pro freeze already covered last week               | inline card |
| `free_earned_freeze`   | Missed week; earned freeze available               | sheet       |
| `free_lifetime_rescue` | Missed week; one-time restore available            | sheet       |
| `pro_available_freeze` | Missed week; Pro freeze available (auto-apply off) | sheet       |
| `free_comeback`        | Missed week; free user with no protection left     | sheet       |
| `pro_comeback`         | Missed week; Pro user with no freezes left         | sheet       |

Informational states use a dismissible inline card so the workout queue stays
visible. Decision states (spend a resource or restart) use `AppBottomSheet`.

## Actions Per State

| State                                                                | Primary                | Secondary                             | Tertiary                    |
| -------------------------------------------------------------------- | ---------------------- | ------------------------------------- | --------------------------- |
| `at_risk`, `pro_auto_applied`                                        | Start a workout        | —                                     | Got it (close)              |
| `free_earned_freeze`, `pro_available_freeze`, `free_lifetime_rescue` | Use freeze / restore   | Start a workout instead               | Not now                     |
| `free_comeback`                                                      | Start comeback workout | Start a new streak (in-sheet confirm) | Not now; quiet Pro link     |
| `pro_comeback`                                                       | Start comeback workout | Adjust my plan                        | Start a new streak; Not now |

The Pro mention is a caption-sized link shown only to free users who have no
protection left. It is never a primary or secondary button.

## Interaction Rules

- Never show a streak surface while a workout is active or the paywall is open.
  The backend cooldown keeps the prompt for later.
- Starting a workout is always available regardless of streak state and never
  waits on a streak mutation.
- Dismissals and comeback bookkeeping are fire-and-forget; failures are logged
  and never shown to the user.
- Applying a protection or restarting keeps the sheet open on failure, shows an
  inline recoverable error, and re-enables the same buttons for retry. Success
  closes the sheet and confirms with a toast.
- Restart requires an in-sheet confirmation that states history is unaffected.
- Only the in-flight button shows a spinner; other actions are disabled.

## Copy Principles

- Describe the missed week neutrally ("a rest week", "the gap from last
  week"), never as a failure.
- Keep it short: titles are one line, bodies at most two or three short
  sentences, button labels two or three words.
- Explain what each choice does and that skipping a protection is fine
  ("your call").
- No loss framing, exclamation marks, urgency, or "upgrade now" language.
  Guarded by `i18n/__tests__/streak-protection-copy.test.ts`.
- All strings live in `i18n/locales/{en,pl}/streak-protection.ts`.

## Known Discrepancy: Qualifying Workouts

`useWorkoutStats` counts every `workout_sessions` row with `status = completed`
toward total workouts and the local streak fallback, while `get_streak_status`
only counts sessions with at least one `set_logs.completed = true` row. A
session finished with zero completed sets therefore increments the total but
not the streak, and the local fallback can briefly disagree with the server
streak.

Current mitigation: the server streak wins whenever it is available
(`resolveStreakWeeks`), and the local value is only used while loading or for
the workout that was just saved.

Proposed follow-up (SWE-139), pending product confirmation of the canonical
rule: add a `qualifying_workout_sessions` view (or `count_qualifying_workouts`
RPC) in Supabase that encodes the completed-set requirement once, then point
`fetchWorkoutStatsBase`, the weekly progress query on Home, and the streak RPCs
at it. This is intentionally not done here because it changes displayed totals
for existing users.

## Implementation Map

- Surface selection and helpers: `apps/mobile/lib/streak-prompt.ts`
- Sheet: `apps/mobile/components/streak/streak-protection-sheet.tsx`
- Inline card: `apps/mobile/components/streak/streak-status-card.tsx`
- Home wiring, analytics, and comeback marker: `apps/mobile/app/(tabs)/index.tsx`
- API and hooks: `apps/mobile/lib/api/streak-protection.ts`,
  `apps/mobile/hooks/use-streak-protection.ts`
- Streak number in stats/summary: `apps/mobile/hooks/use-workout-stats.ts`
