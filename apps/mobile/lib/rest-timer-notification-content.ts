import type { TFunction } from "i18next";
import { z } from "zod";

import type { NextUp } from "@/lib/rest-timer";

const optionalExerciseNameSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

/**
 * Minimal, privacy-safe snapshot of what comes after rest.
 * Intentionally excludes weights, reps, RPE, and other set details that
 * should not appear on the lock-screen notification.
 */
export const restTimerNotificationNextUpSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("set"),
    exerciseName: optionalExerciseNameSchema,
    workingSetNumber: z.number().int().positive().nullable(),
  }),
  z.object({
    kind: z.literal("exercise"),
    exerciseName: optionalExerciseNameSchema,
  }),
  z.object({
    kind: z.literal("done"),
  }),
]);

export type RestTimerNotificationNextUp = z.infer<
  typeof restTimerNotificationNextUpSchema
>;

export interface RestTimerNotificationCopy {
  channelName: string;
  title: string;
  body: string;
}

type TranslateFn = TFunction<"workout">;

function trimName(name: string | undefined | null): string | undefined {
  const trimmed = name?.trim();
  return trimmed ? trimmed : undefined;
}

function isNextUp(value: unknown): value is NextUp {
  if (!value || typeof value !== "object" || !("kind" in value)) return false;

  const kind = (value as { kind: unknown }).kind;
  if (kind === "done") return true;
  if (kind === "set" || kind === "exercise") {
    return "exercise" in value;
  }
  return false;
}

/**
 * Project workout `NextUp` into the validated notification snapshot.
 * Blank exercise names are dropped so callers can fall back safely.
 */
export function toRestTimerNotificationNextUp(
  nextUp: NextUp
): RestTimerNotificationNextUp {
  if (nextUp.kind === "done") {
    return { kind: "done" };
  }

  if (nextUp.kind === "exercise") {
    return {
      kind: "exercise",
      exerciseName: trimName(nextUp.exercise.name),
    };
  }

  return {
    kind: "set",
    exerciseName: trimName(nextUp.exercise.name),
    workingSetNumber: nextUp.workingSetNumber,
  };
}

function parseNextUp(
  nextUp: RestTimerNotificationNextUp | NextUp | unknown
): RestTimerNotificationNextUp | null {
  if (isNextUp(nextUp)) {
    return toRestTimerNotificationNextUp(nextUp);
  }

  const parsed = restTimerNotificationNextUpSchema.safeParse(nextUp);
  return parsed.success ? parsed.data : null;
}

/**
 * Build localized rest-complete notification copy from deterministic next-up
 * state. Falls back to generic copy when data is missing or invalid, and never
 * claims a next exercise/set exists when the workout is finished.
 */
export function buildRestTimerNotificationContent(
  t: TranslateFn,
  nextUp: RestTimerNotificationNextUp | NextUp | unknown
): RestTimerNotificationCopy {
  const channelName = t("restTimerNotification.channelName");
  const title = t("restTimerNotification.title");
  const fallbackBody = t("restTimerNotification.body");

  const snapshot = parseNextUp(nextUp);
  if (!snapshot) {
    return { channelName, title, body: fallbackBody };
  }

  if (snapshot.kind === "done") {
    return {
      channelName,
      title,
      body: t("restTimerNotification.bodyAllDone"),
    };
  }

  if (snapshot.kind === "exercise") {
    if (!snapshot.exerciseName) {
      return { channelName, title, body: fallbackBody };
    }

    return {
      channelName,
      title,
      body: t("restTimerNotification.bodyNextExercise", {
        exerciseName: snapshot.exerciseName,
      }),
    };
  }

  if (snapshot.workingSetNumber === null) {
    if (snapshot.exerciseName) {
      return {
        channelName,
        title,
        body: t("restTimerNotification.bodyNextWarmup", {
          exerciseName: snapshot.exerciseName,
        }),
      };
    }

    return {
      channelName,
      title,
      body: t("restTimerNotification.bodyNextWarmupOnly"),
    };
  }

  if (snapshot.exerciseName) {
    return {
      channelName,
      title,
      body: t("restTimerNotification.bodyNextSet", {
        exerciseName: snapshot.exerciseName,
        number: snapshot.workingSetNumber,
      }),
    };
  }

  return {
    channelName,
    title,
    body: t("restTimerNotification.bodyNextSetOnly", {
      number: snapshot.workingSetNumber,
    }),
  };
}
