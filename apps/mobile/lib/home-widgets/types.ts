import type { AppLanguage } from "@/i18n";

/**
 * JSON contract between the app and the iOS widget extension. The Swift
 * mirror lives in `targets/widget/Home/HomeWidgetSnapshot.swift`; bump the
 * version (and the storage key on both sides) for breaking changes.
 *
 * All copy is rendered by the app so plurals and the in-app language match.
 * Dates are local calendar keys (`YYYY-MM-DD`, weeks start on Monday) so the
 * widget can resolve "today", future days and week rollovers on its own.
 */
export const WIDGET_SNAPSHOT_VERSION = 1;

export type WidgetSnapshotStatus = "ready" | "signedOut" | "setupRequired";

export type WidgetNextWorkoutState =
  | "ready"
  | "inProgress"
  | "preparing"
  | "failed"
  | "empty";

export interface WidgetExerciseRow {
  name: string;
  detail: string;
}

export interface WidgetNextWorkout {
  state: WidgetNextWorkoutState;
  /** Screen to open on tap; `null` just brings the app forward where it was. */
  deepLink: string | null;
  eyebrow: string;
  eyebrowShort: string;
  upNext: string;
  title: string;
  /** Short name for the circular Lock Screen widget. */
  shortTitle: string;
  focus: string | null;
  meta: string | null;
  metaShort: string | null;
  inline: string;
  exercises: WidgetExerciseRow[];
  moreExercises: string | null;
  action: string;
  actionShort: string;
}

export interface WidgetWeek {
  /** Local Monday of the week the counts belong to. */
  weekStart: string;
  done: number;
  target: number;
  of: string;
  thisWeekShort: string;
  ringCaptionShort: string;
}

export interface WidgetStreak {
  weeks: number;
  longestWeeks: number;
  label: string;
  unit: string;
  unitShort: string;
  title: string;
  inline: string;
  longest: string;
  freezes: string | null;
  startTitle: string;
}

export interface WidgetActivityDay {
  date: string;
  trained: boolean;
}

export interface WidgetConsistency {
  /** 12 full weeks (Monday–Sunday), oldest first, ending with the current week. */
  days: WidgetActivityDay[];
  label: string;
  windowShort: string;
  sessionsShort: number;
  sessionsShortUnit: string;
  averageShort: string;
  sessionsLong: number;
  sessionsLongUnit: string;
  inLastWeeks: string;
  weeksLong: string;
  averageLongValue: string;
  averageLongCaption: string;
  currentStreakValue: string;
  currentStreakCaption: string;
  longestStreakValue: string;
  longestStreakCaption: string;
}

export interface WidgetWeekMinutes {
  weekStart: string;
  minutes: number;
}

export interface WidgetLastWorkout {
  name: string;
  completedAt: string;
  minutes: string;
}

export interface WidgetTrainingTime {
  /** 8 weeks, oldest first, ending with the current week. */
  weeks: WidgetWeekMinutes[];
  label: string;
  window: string;
  weeksLabel: string;
  minutesUnit: string;
  thisWeek: string;
  averageMinutes: number;
  average: string;
  averageInline: string;
  totalHours: string;
  totalCaption: string;
  bestWeek: string;
  bestWeekCaption: string;
  totalWorkouts: number | null;
  totalWorkoutsCaption: string;
  lastPrefix: string;
  lastWorkout: WidgetLastWorkout | null;
}

export interface WidgetSnapshot {
  version: typeof WIDGET_SNAPSHOT_VERSION;
  generatedAt: string;
  language: AppLanguage;
  status: WidgetSnapshotStatus;
  message: string | null;
  /** Monday-first single letters, e.g. "M T W T F S S". */
  dayLetters: string[];
  next: WidgetNextWorkout;
  week: WidgetWeek;
  streak: WidgetStreak;
  consistency: WidgetConsistency;
  trainingTime: WidgetTrainingTime;
}
