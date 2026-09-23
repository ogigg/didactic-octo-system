import type { TFunction } from "i18next";
import { z } from "zod";

import type { AppLanguage } from "@/i18n";
import { generateWorkoutResponseSchema } from "@/lib/api/generate-workout";
import type { PendingWorkout } from "@/lib/api/pending-workouts";
import type { SessionDurationRow } from "@/lib/api/workouts";
import { countWorkingSets } from "@/lib/exercise-set-structure";
import { formatExerciseDuration } from "@/lib/format-exercise-duration";
import { getTargetQueueCount } from "@/lib/pending-workout-queue";
import { getCalendarWeekStartKey } from "@/lib/streak-calendar";
import { buildWeeklyMinutes } from "@/lib/weekly-activity";
import { estimateWorkoutMinutes } from "@/lib/workout-duration-estimate";
import { selectNextWorkout } from "@/stores/pending-workout-store";

import {
  buildActivityDays,
  CONSISTENCY_SHORT_WEEKS,
  CONSISTENCY_WEEKS,
  countSessionsInWindow,
  SUMMARY_WEEKS,
  TRAINING_TIME_WEEKS,
} from "./activity";
import {
  WIDGET_SNAPSHOT_VERSION,
  type WidgetConsistency,
  type WidgetConsistencyStats,
  type WidgetExerciseRow,
  type WidgetNextWorkout,
  type WidgetSnapshot,
  type WidgetStreak,
  type WidgetTrainingTime,
  type WidgetTrainingTimeStats,
  type WidgetWeek,
  type WidgetWeekSummary,
} from "./types";

export const MAX_WIDGET_EXERCISES = 6;

export type WidgetTranslate = TFunction<"widgets">;

export interface WidgetStreakInput {
  currentWeeks: number;
  longestWeeks: number;
  freezes: number;
  /** Pro freezes the server applies by itself to missed weeks. */
  autoFreezes: number;
}

export interface WidgetLastWorkoutInput {
  name: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface WidgetSnapshotInput {
  now: Date;
  language: AppLanguage;
  t: WidgetTranslate;
  isSignedIn: boolean;
  setupCompleted: boolean;
  weeklyFrequency: string | null | undefined;
  queue: readonly PendingWorkout[];
  /** Name of the workout currently being trained, if any. */
  activeWorkoutName: string | null;
  localizeExerciseName: (exerciseId: string, fallback: string) => string;
  streak: WidgetStreakInput | null;
  /** Completed sessions with at least one completed set, last 12 weeks. */
  qualifyingCompletedAt: readonly string[];
  /** Completed sessions with start and end times, last 8 weeks. */
  sessionDurations: readonly SessionDurationRow[];
  totalWorkouts: number | null;
  lastWorkout: WidgetLastWorkoutInput | null;
}

const generatedExerciseSchema =
  generateWorkoutResponseSchema.shape.exercises.element;

// The preview and pending swaps save blank set targets as null.
const savedSetSchema = generatedExerciseSchema.shape.sets.element.extend({
  target_load_kg: z.number().nullish(),
  target_reps: z.number().nullish(),
  target_duration_seconds: z.number().nullish(),
});

const exercisesSchema = z.array(
  generatedExerciseSchema.extend({ sets: z.array(savedSetSchema) })
);

type SourceExercise = z.infer<typeof exercisesSchema>[number];

/**
 * Mirrors the workout preview: saved user edits replace the generated list.
 * `user_edits` is only typed as a record, so edits are validated first and
 * malformed ones fall back to the generated exercises instead of throwing.
 */
export function resolvePendingWorkoutExercises(
  workout: PendingWorkout
): SourceExercise[] {
  const edited = (workout.user_edits as { exercises?: unknown } | null)
    ?.exercises;
  if (edited !== undefined) {
    const parsed = exercisesSchema.safeParse(edited);
    if (parsed.success) return parsed.data;
  }
  return workout.workout_data?.exercises ?? [];
}

function describeSets(exercise: SourceExercise): string {
  const working = exercise.sets.filter((set) => set.set_type === "working");
  const count = countWorkingSets(exercise.sets) || exercise.sets.length;

  if (exercise.exercise_type === "time") {
    const seconds = working.find(
      (set) => (set.target_duration_seconds ?? 0) > 0
    )?.target_duration_seconds;
    return seconds
      ? `${count} × ${formatExerciseDuration(seconds)}`
      : `${count} ×`;
  }

  const reps = working
    .map((set) => set.target_reps)
    .filter((value): value is number => typeof value === "number" && value > 0);
  if (reps.length === 0) return `${count} ×`;
  const min = Math.min(...reps);
  const max = Math.max(...reps);
  return `${count} × ${min === max ? min : `${min}–${max}`}`;
}

function formatDecimal(value: number, language: AppLanguage): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(
    value
  );
}

function buildNextWorkout(input: WidgetSnapshotInput): WidgetNextWorkout {
  const { t } = input;
  const base = {
    eyebrow: t("next.eyebrow"),
    eyebrowShort: t("next.eyebrowShort"),
    upNext: t("next.upNext"),
    action: t("next.action"),
    actionShort: t("next.actionShort"),
    focus: null,
    exercises: [],
    moreExercises: null,
  };

  if (input.activeWorkoutName !== null) {
    return {
      ...base,
      state: "inProgress",
      deepLink: "sweaty://workout",
      eyebrow: t("next.inProgressEyebrow"),
      eyebrowShort: t("next.inProgressEyebrow"),
      title: input.activeWorkoutName || t("next.inProgressTitle"),
      shortTitle: t("next.inProgressEyebrow"),
      meta: t("next.inProgressTitle"),
      metaShort: t("next.inProgressTitle"),
      inline: t("next.inlineInProgress"),
      action: t("next.resume"),
    };
  }

  const next = selectNextWorkout([...input.queue]);
  if (!next?.workout_data) {
    const state =
      input.queue.length === 0
        ? "empty"
        : input.queue.every((workout) => workout.status === "failed")
          ? "failed"
          : "preparing";
    const title = t(`next.${state}Title`);
    return {
      ...base,
      state,
      deepLink: null,
      title,
      shortTitle: t("next.eyebrowShort"),
      meta: state === "preparing" ? null : t(`next.${state}Hint`),
      metaShort: null,
      inline: state === "empty" ? t("next.inlineEmpty") : title,
    };
  }

  const exercises = resolvePendingWorkoutExercises(next);
  const minutes = estimateWorkoutMinutes(exercises, next.workout_data.warmup);
  const focus = next.focus_area ? t(`focus.${next.focus_area}`) : null;
  const title = next.workout_data.workout_name;
  const rows: WidgetExerciseRow[] = exercises
    .slice(0, MAX_WIDGET_EXERCISES)
    .map((exercise) => ({
      name: input.localizeExerciseName(
        exercise.exercise_id,
        exercise.exercise_name
      ),
      detail: describeSets(exercise),
    }));
  const hidden = exercises.length - rows.length;

  return {
    ...base,
    state: "ready",
    deepLink: `sweaty://workout-preview?id=${encodeURIComponent(next.id)}`,
    title,
    shortTitle: focus ?? title,
    focus,
    meta: t("next.meta", {
      exercises: t("next.exercises", { count: exercises.length }),
      minutes: t("next.minutes", { count: minutes }),
    }),
    metaShort: t("next.meta", {
      exercises: t("next.exercisesShort", { count: exercises.length }),
      minutes: t("next.minutesShort", { count: minutes }),
    }),
    inline: t("next.inline", { name: focus ?? title, minutes }),
    exercises: rows,
    moreExercises: hidden > 0 ? t("next.more", { count: hidden }) : null,
  };
}

function buildWeek(input: WidgetSnapshotInput): WidgetWeek {
  const { t } = input;
  const done = countSessionsInWindow(input.qualifyingCompletedAt, input.now, 1);
  return {
    weekStart: getCalendarWeekStartKey(input.now),
    done,
    target: getTargetQueueCount(input.weeklyFrequency),
    of: t("week.of"),
    thisWeekShort: t("week.thisWeekShort"),
    ringCaptionShort: t("week.ringCaptionShort"),
  };
}

export interface ProjectedStreak {
  weeks: number;
  longestWeeks: number;
  freezes: number;
}

/**
 * Streak the app would report `offset` weeks after the snapshot when nothing
 * new is logged, following `get_streak_status`: a missed week breaks the
 * streak unless a Pro freeze covers it automatically, newest week first, and
 * covered weeks count. Earned freezes wait for the user, so they never apply.
 */
export function projectStreak(
  streak: WidgetStreakInput | null,
  trainedThisWeek: boolean,
  offset: number
): ProjectedStreak {
  const weeks = streak?.currentWeeks ?? 0;
  const longestWeeks = Math.max(streak?.longestWeeks ?? 0, weeks);
  const freezes = streak?.freezes ?? 0;
  // A week with a session still counts after it ends.
  const missed = trainedThisWeek ? offset - 1 : offset;
  if (missed <= 0 || weeks === 0) return { weeks, longestWeeks, freezes };

  const covered = Math.min(streak?.autoFreezes ?? 0, missed);
  const projected = covered === missed ? weeks + missed : covered;
  return {
    weeks: projected,
    longestWeeks: Math.max(longestWeeks, projected),
    freezes: freezes - covered,
  };
}

/** Same time of day `offset` weeks later, so a DST change keeps the date. */
function atWeekOffset(now: Date, offset: number): Date {
  const date = new Date(now.getTime());
  date.setDate(date.getDate() + 7 * offset);
  return date;
}

function buildStreak(
  t: WidgetTranslate,
  { weeks, longestWeeks, freezes }: ProjectedStreak
): WidgetStreak {
  return {
    weeks,
    longestWeeks,
    label: t("streak.label"),
    unit: t("streak.unit", { count: weeks }),
    unitShort: t("streak.unitShort"),
    title: t("streak.title", { count: weeks }),
    inline: t("streak.inline", { count: weeks }),
    longest: t("streak.longest", { count: longestWeeks }),
    freezes: freezes > 0 ? t("streak.freezes", { count: freezes }) : null,
    startTitle: t("streak.startTitle"),
  };
}

function buildConsistency(input: WidgetSnapshotInput): WidgetConsistency {
  const { t, now, qualifyingCompletedAt } = input;
  return {
    days: buildActivityDays(qualifyingCompletedAt, now, CONSISTENCY_WEEKS),
    label: t("consistency.label"),
    windowShort: t("consistency.window", { count: CONSISTENCY_SHORT_WEEKS }),
    inLastWeeks: t("consistency.inLastWeeks", { count: CONSISTENCY_WEEKS }),
    weeksLong: t("consistency.weeks", { count: CONSISTENCY_WEEKS }),
    averageLongCaption: t("consistency.averageCaption"),
    currentStreakCaption: t("consistency.currentStreakCaption"),
    longestStreakCaption: t("consistency.longestStreakCaption"),
  };
}

function buildConsistencyStats(
  input: WidgetSnapshotInput,
  at: Date,
  streak: WidgetStreak
): WidgetConsistencyStats {
  const { t, language, qualifyingCompletedAt } = input;
  const sessionsShort = countSessionsInWindow(
    qualifyingCompletedAt,
    at,
    CONSISTENCY_SHORT_WEEKS
  );
  const sessionsLong = countSessionsInWindow(
    qualifyingCompletedAt,
    at,
    CONSISTENCY_WEEKS
  );
  return {
    sessionsShort,
    sessionsShortUnit: t("consistency.sessionsUnit", { count: sessionsShort }),
    averageShort: t("consistency.average", {
      value: formatDecimal(sessionsShort / CONSISTENCY_SHORT_WEEKS, language),
    }),
    sessionsLong,
    sessionsLongUnit: t("consistency.sessionsUnit", { count: sessionsLong }),
    averageLongValue: formatDecimal(sessionsLong / CONSISTENCY_WEEKS, language),
    currentStreakValue: `${streak.weeks} ${streak.unitShort}`,
    longestStreakValue: `${streak.longestWeeks} ${streak.unitShort}`,
  };
}

function buildTrainingTime(input: WidgetSnapshotInput): WidgetTrainingTime {
  const { t } = input;
  const last = input.lastWorkout;
  const lastStarted = last?.startedAt ? Date.parse(last.startedAt) : NaN;
  const lastCompleted = last?.completedAt ? Date.parse(last.completedAt) : NaN;
  const lastMinutes =
    Number.isFinite(lastStarted) && lastCompleted > lastStarted
      ? Math.round((lastCompleted - lastStarted) / 60_000)
      : null;

  return {
    weeks: buildWeeklyMinutes(
      input.sessionDurations,
      input.now,
      TRAINING_TIME_WEEKS
    ),
    label: t("time.label"),
    window: t("time.window", { count: TRAINING_TIME_WEEKS }),
    weeksLabel: t("time.weeks", { count: TRAINING_TIME_WEEKS }),
    minutesUnit: t("time.minutesUnit"),
    thisWeek: t("time.thisWeek"),
    totalCaption: t("time.totalCaption", { count: TRAINING_TIME_WEEKS }),
    bestWeekCaption: t("time.bestWeekCaption"),
    totalWorkouts: input.totalWorkouts,
    totalWorkoutsCaption: t("time.totalWorkoutsCaption", {
      count: input.totalWorkouts ?? 0,
    }),
    lastPrefix: t("time.lastPrefix"),
    lastWorkout:
      last?.completedAt && Number.isFinite(lastCompleted)
        ? {
            name: last.name ?? "",
            // Normalized so Swift's ISO 8601 parser never sees microseconds.
            completedAt: new Date(lastCompleted).toISOString(),
            minutes:
              lastMinutes !== null
                ? t("time.minutes", { count: lastMinutes })
                : "",
          }
        : null,
  };
}

function buildTrainingTimeStats(
  input: WidgetSnapshotInput,
  at: Date
): WidgetTrainingTimeStats {
  const { t, language } = input;
  const weeks = buildWeeklyMinutes(
    input.sessionDurations,
    at,
    TRAINING_TIME_WEEKS
  );
  const completedWeeks = weeks.slice(0, -1);
  const averageMinutes = Math.round(
    completedWeeks.reduce((sum, week) => sum + week.minutes, 0) /
      Math.max(1, completedWeeks.length)
  );
  const totalMinutes = weeks.reduce((sum, week) => sum + week.minutes, 0);
  const bestMinutes = Math.max(0, ...weeks.map((week) => week.minutes));

  return {
    averageMinutes,
    average: t("time.average", { count: averageMinutes }),
    averageInline: t("time.averageInline", { count: averageMinutes }),
    totalHours: t("time.hours", {
      value: formatDecimal(totalMinutes / 60, language),
    }),
    bestWeek: t("time.minutes", { count: bestMinutes }),
  };
}

function buildWeekSummary(
  input: WidgetSnapshotInput,
  trainedThisWeek: boolean,
  offset: number
): WidgetWeekSummary {
  const at = atWeekOffset(input.now, offset);
  const streak = buildStreak(
    input.t,
    projectStreak(input.streak, trainedThisWeek, offset)
  );
  return {
    weekStart: getCalendarWeekStartKey(at),
    streak,
    consistency: buildConsistencyStats(input, at, streak),
    trainingTime: buildTrainingTimeStats(input, at),
  };
}

export function buildWidgetSnapshot(
  input: WidgetSnapshotInput
): WidgetSnapshot {
  const { t } = input;
  const status = !input.isSignedIn
    ? "signedOut"
    : input.setupCompleted
      ? "ready"
      : "setupRequired";
  const week = buildWeek(input);

  return {
    version: WIDGET_SNAPSHOT_VERSION,
    generatedAt: input.now.toISOString(),
    language: input.language,
    status,
    message:
      status === "signedOut"
        ? t("status.signedOut")
        : status === "setupRequired"
          ? t("status.setupRequired")
          : null,
    dayLetters: t("dayLetters").split(" "),
    next: buildNextWorkout(input),
    week,
    summaries: Array.from({ length: SUMMARY_WEEKS }, (_, offset) =>
      buildWeekSummary(input, week.done > 0, offset)
    ),
    consistency: buildConsistency(input),
    trainingTime: buildTrainingTime(input),
  };
}
