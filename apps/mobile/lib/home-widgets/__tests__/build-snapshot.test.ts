import i18next from "i18next";

import type { AppLanguage } from "@/i18n";
import { resources } from "@/i18n/resources";
import type { PendingWorkout } from "@/lib/api/pending-workouts";
import {
  applyPendingExerciseSwap,
  type PendingPreviewExercise,
} from "@/lib/pending-exercise-swap";

import {
  buildWidgetSnapshot,
  type WidgetSnapshotInput,
  type WidgetStreakInput,
  type WidgetTranslate,
} from "../build-snapshot";
import type { WidgetConsistencyStats } from "../types";

// Wednesday 23 September 2026, 12:00 local time.
const NOW = new Date(2026, 8, 23, 12, 0, 0);

async function translator(language: AppLanguage): Promise<WidgetTranslate> {
  const instance = i18next.createInstance();
  await instance.init({
    resources,
    lng: language,
    fallbackLng: "en",
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });
  return instance.getFixedT(language, "widgets");
}

function exercise(
  id: string,
  overrides: Partial<
    NonNullable<PendingWorkout["workout_data"]>["exercises"][number]
  > = {}
) {
  return {
    exercise_id: id,
    exercise_name: `Exercise ${id}`,
    exercise_type: "weight" as const,
    rest_duration_seconds: 90,
    notes: null,
    sets: [
      { set_type: "warmup" as const, target_reps: 12 },
      { set_type: "working" as const, target_reps: 8 },
      { set_type: "working" as const, target_reps: 8 },
      { set_type: "working" as const, target_reps: 8 },
    ],
    ...overrides,
  };
}

function pendingWorkout(
  overrides: Partial<PendingWorkout> = {}
): PendingWorkout {
  return {
    id: "workout-1",
    user_id: "user-1",
    queue_position: 0,
    status: "ready",
    workout_data: {
      workout_name: "Push A",
      warmup: null,
      generation_source: "llm",
      goal_snapshot: "build_muscle",
      custom_goal_snapshot: null,
      exercises: [exercise("bench"), exercise("press")],
    },
    generation_source: "llm",
    focus_area: "push",
    generated_at: null,
    last_regenerated_at: null,
    regeneration_count: 0,
    regeneration_feedback: null,
    user_edits: null,
    created_at: "2026-09-20T10:00:00Z",
    updated_at: "2026-09-20T10:00:00Z",
    ...overrides,
  };
}

async function input(
  overrides: Partial<WidgetSnapshotInput> = {},
  language: AppLanguage = "pl"
): Promise<WidgetSnapshotInput> {
  return {
    now: NOW,
    language,
    t: await translator(language),
    isSignedIn: true,
    setupCompleted: true,
    weeklyFrequency: "3",
    queue: [pendingWorkout()],
    activeWorkoutName: null,
    localizeExerciseName: (_id, fallback) => fallback,
    streak: { currentWeeks: 5, longestWeeks: 8, freezes: 1, autoFreezes: 0 },
    qualifyingCompletedAt: [],
    sessionDurations: [],
    totalWorkouts: 48,
    lastWorkout: null,
    ...overrides,
  };
}

describe("buildWidgetSnapshot", () => {
  describe("next workout", () => {
    it("describes the first ready workout in the queue", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({
          queue: [
            pendingWorkout({ id: "generating", status: "generating" }),
            pendingWorkout({ id: "ready id" }),
          ],
          localizeExerciseName: (id, fallback) =>
            id === "bench" ? "Wyciskanie sztangi" : fallback,
        })
      );

      expect(snapshot.next).toMatchObject({
        state: "ready",
        deepLink: "sweaty://workout-preview?id=ready%20id",
        title: "Push A",
        focus: "Push",
        shortTitle: "Push",
        meta: "2 ćwiczenia · ok. 17 min",
        metaShort: "2 ćw. · 17 min",
        inline: "Dalej: Push · 17 min",
        moreExercises: null,
      });
      expect(snapshot.next.exercises).toEqual([
        { name: "Wyciskanie sztangi", detail: "3 × 8" },
        { name: "Exercise press", detail: "3 × 8" },
      ]);
    });

    it("prefers the user's saved exercise edits", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({
          queue: [
            pendingWorkout({
              user_edits: { exercises: [exercise("swapped")] },
            }),
          ],
        })
      );

      expect(snapshot.next.exercises.map((row) => row.name)).toEqual([
        "Exercise swapped",
      ]);
    });

    it("uses edits saved by the preview, which store blank targets as null", async () => {
      const edited: PendingPreviewExercise = {
        exercise_id: "incline",
        exercise_name: "Incline press",
        exercise_type: "weight",
        image: null,
        rest_duration_seconds: 90,
        notes: null,
        reasoning: null,
        progression_type: null,
        previous_display: null,
        sets: [
          {
            set_type: "warmup",
            target_load_kg: null,
            target_reps: null,
            target_duration_seconds: null,
          },
          {
            set_type: "working",
            target_load_kg: 60,
            target_reps: 10,
            target_duration_seconds: null,
          },
          {
            set_type: "working",
            target_load_kg: null,
            target_reps: null,
            target_duration_seconds: null,
          },
        ],
      };
      const swapped = applyPendingExerciseSwap(edited, {
        id: "row",
        name: "Row",
      });
      const snapshot = buildWidgetSnapshot(
        await input({
          queue: [
            pendingWorkout({
              // Round-tripped like the JSONB column, so null keys survive.
              user_edits: JSON.parse(
                JSON.stringify({
                  exercises: [edited, swapped],
                  edit_types: ["swap_exercise", "edit_set"],
                  edited_at: "2026-09-22T18:00:00Z",
                })
              ),
            }),
          ],
        })
      );

      expect(snapshot.next.exercises).toEqual([
        { name: "Incline press", detail: "2 × 10" },
        { name: "Row", detail: "2 ×" },
      ]);
    });

    it("falls back to the generated exercises when saved edits are malformed", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({
          queue: [
            pendingWorkout({
              user_edits: {
                exercises: [
                  { exercise_id: "broken", exercise_name: "No sets" },
                ],
              },
            }),
          ],
        })
      );

      expect(snapshot.next.exercises.map((row) => row.name)).toEqual([
        "Exercise bench",
        "Exercise press",
      ]);
    });

    it("summarizes rep ranges, timed sets and hidden exercises", async () => {
      const exercises = [
        exercise("range", {
          sets: [
            { set_type: "working", target_reps: 8 },
            { set_type: "working", target_reps: 10 },
          ],
        }),
        exercise("plank", {
          exercise_type: "time",
          sets: [
            { set_type: "working", target_duration_seconds: 45 },
            { set_type: "working", target_duration_seconds: 45 },
            { set_type: "working", target_duration_seconds: 45 },
          ],
        }),
        ...["c", "d", "e", "f", "g", "h"].map((id) => exercise(id)),
      ];
      const snapshot = buildWidgetSnapshot(
        await input({
          queue: [
            pendingWorkout({
              workout_data: {
                ...pendingWorkout().workout_data!,
                exercises,
              },
            }),
          ],
        })
      );

      expect(snapshot.next.exercises).toHaveLength(6);
      expect(snapshot.next.exercises[0]?.detail).toBe("2 × 8–10");
      expect(snapshot.next.exercises[1]?.detail).toBe("3 × 0:45");
      expect(snapshot.next.moreExercises).toBe("+ 2 kolejne ćwiczenia");
      expect(snapshot.next.meta).toMatch(/^8 ćwiczeń · /);
    });

    it("links to the running workout while one is in progress", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({ activeWorkoutName: "Nogi B" })
      );

      expect(snapshot.next).toMatchObject({
        state: "inProgress",
        deepLink: "sweaty://workout",
        title: "Nogi B",
        inline: "Trening w toku",
      });
    });

    it("reports a queue that is still generating", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({ queue: [pendingWorkout({ status: "generating" })] })
      );

      expect(snapshot.next).toMatchObject({
        state: "preparing",
        title: "Przygotowujemy trening…",
        deepLink: null,
      });
    });

    it("reports a queue whose generation failed instead of preparing forever", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({
          queue: [
            pendingWorkout({ id: "a", status: "failed" }),
            pendingWorkout({ id: "b", status: "failed" }),
          ],
        })
      );

      expect(snapshot.next).toMatchObject({
        state: "failed",
        title: "Nie udało się przygotować treningu",
        meta: "Otwórz Sweaty, aby spróbować ponownie",
        deepLink: null,
      });
    });

    it("keeps preparing while any queued workout is still generating", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({
          queue: [
            pendingWorkout({ id: "a", status: "failed" }),
            pendingWorkout({ id: "b", status: "queued" }),
          ],
        })
      );

      expect(snapshot.next.state).toBe("preparing");
    });

    it("reports an empty queue", async () => {
      const snapshot = buildWidgetSnapshot(await input({ queue: [] }));

      expect(snapshot.next).toMatchObject({
        state: "empty",
        title: "Brak zaplanowanego treningu",
        inline: "Brak zaplanowanego treningu",
      });
    });
  });

  describe("week and streak", () => {
    it("counts this week's sessions against the weekly target", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({
          weeklyFrequency: "5_plus",
          qualifyingCompletedAt: [
            "2026-09-20T18:00:00",
            "2026-09-21T07:30:00",
            "2026-09-23T06:15:00",
          ],
        })
      );

      expect(snapshot.week).toMatchObject({
        weekStart: "2026-09-21",
        done: 2,
        target: 5,
        of: "z",
      });
    });

    it.each([
      [1, "1 tydzień serii", "tydzień"],
      [2, "2 tygodnie serii", "tygodnie"],
      [5, "5 tygodni serii", "tygodni"],
      [22, "22 tygodnie serii", "tygodnie"],
    ])(
      "uses Polish plurals for a %i-week streak",
      async (weeks, title, unit) => {
        const snapshot = buildWidgetSnapshot(
          await input({
            streak: {
              currentWeeks: weeks,
              longestWeeks: 30,
              freezes: 0,
              autoFreezes: 0,
            },
          })
        );
        const streak = snapshot.summaries[0]!.streak;

        expect(streak.title).toBe(title);
        expect(streak.unit).toBe(unit);
        expect(streak.freezes).toBeNull();
      }
    );

    it("lists saved freezes and never reports a longest streak below the current one", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({
          streak: {
            currentWeeks: 9,
            longestWeeks: 4,
            freezes: 2,
            autoFreezes: 0,
          },
        })
      );
      const [current] = snapshot.summaries;

      expect(current!.streak.freezes).toBe("2 zamrożenia w zapasie");
      expect(current!.streak.longest).toBe("Najdłuższa: 9 tyg.");
      expect(current!.consistency.longestStreakValue).toBe("9 tyg.");
    });

    it("starts from zero without streak data", async () => {
      const snapshot = buildWidgetSnapshot(await input({ streak: null }));

      expect(snapshot.summaries[0]!.streak).toMatchObject({
        weeks: 0,
        longestWeeks: 0,
        startTitle: "Zacznij serię",
      });
    });
  });

  describe("consistency and training time", () => {
    const sessionDurations = [
      {
        started_at: "2026-08-03T08:00:00",
        completed_at: "2026-08-03T09:35:00",
      },
      {
        started_at: "2026-09-14T08:00:00",
        completed_at: "2026-09-14T08:44:00",
      },
      {
        started_at: "2026-09-21T08:00:00",
        completed_at: "2026-09-21T08:50:00",
      },
      {
        started_at: "2026-09-23T07:00:00",
        completed_at: "2026-09-23T07:47:00",
      },
    ];

    it("counts sessions per window with localized averages", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({
          qualifyingCompletedAt: [
            "2026-07-10T08:00:00",
            "2026-08-03T09:35:00",
            "2026-09-21T08:50:00",
          ],
        })
      );

      expect(snapshot.summaries[0]!.consistency).toMatchObject({
        sessionsShort: 2,
        sessionsShortUnit: "treningi",
        averageShort: "średnio 0,3 w tygodniu",
        sessionsLong: 3,
        sessionsLongUnit: "treningi",
        averageLongValue: "0,3",
        currentStreakValue: "5 tyg.",
      });
      expect(snapshot.consistency.days).toHaveLength(84);
    });

    it("averages completed weeks and totals the window", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({
          sessionDurations,
          lastWorkout: {
            name: "Pull",
            startedAt: "2026-09-23T07:00:00",
            completedAt: "2026-09-23T07:47:00",
          },
        })
      );

      // (95 + 44) minutes over the seven completed weeks.
      expect(snapshot.summaries[0]!.trainingTime).toEqual({
        averageMinutes: 20,
        average: "Średnio 20 min",
        averageInline: expect.any(String),
        totalHours: "3,9 h",
        bestWeek: "97 min",
      });
      expect(snapshot.trainingTime.weeks[7]?.minutes).toBe(97);
      expect(snapshot.trainingTime.totalWorkoutsCaption).toBe(
        "treningów łącznie"
      );
      expect(snapshot.trainingTime.lastWorkout).toEqual({
        name: "Pull",
        completedAt: new Date("2026-09-23T07:47:00").toISOString(),
        minutes: "47 min",
      });
    });

    it("formats decimals in English", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({ sessionDurations }, "en")
      );

      expect(snapshot.summaries[0]!.trainingTime.totalHours).toBe("3.9 h");
      expect(snapshot.dayLetters).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    });
  });

  describe("weeks after the snapshot", () => {
    // Same fixtures as above: the oldest session drops out of each window first.
    const qualifyingCompletedAt = [
      "2026-07-10T08:00:00",
      "2026-08-03T09:35:00",
      "2026-09-21T08:50:00",
    ];
    const sessionDurations = [
      {
        started_at: "2026-08-03T08:00:00",
        completed_at: "2026-08-03T09:35:00",
      },
      {
        started_at: "2026-09-14T08:00:00",
        completed_at: "2026-09-14T08:44:00",
      },
      {
        started_at: "2026-09-21T08:00:00",
        completed_at: "2026-09-21T08:50:00",
      },
      {
        started_at: "2026-09-23T07:00:00",
        completed_at: "2026-09-23T07:47:00",
      },
    ];

    function weeksLater(weeks: number): Date {
      return new Date(2026, 8, 23 + 7 * weeks, 12, 0, 0);
    }

    function streakInput(
      overrides: Partial<WidgetStreakInput> = {}
    ): WidgetStreakInput {
      return {
        currentWeeks: 5,
        longestWeeks: 8,
        freezes: 0,
        autoFreezes: 0,
        ...overrides,
      };
    }

    it("has one summary per week until every window is empty", async () => {
      const snapshot = buildWidgetSnapshot(await input());

      expect(snapshot.summaries.map((summary) => summary.weekStart)).toEqual([
        "2026-09-21",
        "2026-09-28",
        "2026-10-05",
        "2026-10-12",
        "2026-10-19",
        "2026-10-26",
        "2026-11-02",
        "2026-11-09",
        "2026-11-16",
        "2026-11-23",
        "2026-11-30",
        "2026-12-07",
        "2026-12-14",
      ]);
    });

    it.each([1, 3, 8, 12])(
      "gives the totals of a snapshot built %i weeks later",
      async (weeks) => {
        const data = { qualifyingCompletedAt, sessionDurations };
        const early = buildWidgetSnapshot(await input(data));
        const later = buildWidgetSnapshot(
          await input({ ...data, now: weeksLater(weeks) })
        );

        expect(early.summaries[weeks]!.weekStart).toBe(
          later.summaries[0]!.weekStart
        );
        // Streak values are projected, so only the windowed totals compare.
        const windowed = ({
          currentStreakValue: _current,
          longestStreakValue: _longest,
          ...totals
        }: WidgetConsistencyStats) => totals;
        expect(windowed(early.summaries[weeks]!.consistency)).toEqual(
          windowed(later.summaries[0]!.consistency)
        );
        expect(early.summaries[weeks]!.trainingTime).toEqual(
          later.summaries[0]!.trainingTime
        );
      }
    );

    it("drops the oldest week from the totals a week later", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({ qualifyingCompletedAt, sessionDurations })
      );
      const nextWeek = snapshot.summaries[1]!;

      expect(nextWeek.consistency).toMatchObject({
        sessionsShort: 1,
        sessionsShortUnit: "trening",
        averageShort: "średnio 0,1 w tygodniu",
        sessionsLong: 2,
        sessionsLongUnit: "treningi",
      });
      // The 95-minute week of 3 August leaves the eight-week window.
      expect(nextWeek.trainingTime).toMatchObject({
        averageMinutes: 20,
        totalHours: "2,4 h",
        bestWeek: "97 min",
      });
      expect(snapshot.summaries[8]!.trainingTime).toMatchObject({
        averageMinutes: 0,
        totalHours: "0 h",
        bestWeek: "0 min",
      });
    });

    it("keeps a streak through the next week only when this week counts", async () => {
      const trained = buildWidgetSnapshot(
        await input({
          streak: streakInput(),
          qualifyingCompletedAt: ["2026-09-22T08:00:00"],
        })
      );
      const untrained = buildWidgetSnapshot(
        await input({ streak: streakInput() })
      );

      expect(trained.summaries[1]!.streak.title).toBe("5 tygodni serii");
      expect(trained.summaries[2]!.streak.weeks).toBe(0);
      expect(trained.summaries[2]!.consistency).toMatchObject({
        currentStreakValue: "0 tyg.",
        longestStreakValue: "8 tyg.",
      });
      expect(untrained.summaries[0]!.streak.weeks).toBe(5);
      expect(untrained.summaries[1]!.streak.weeks).toBe(0);
    });

    it("does not spend earned freezes, which wait for the user", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({ streak: streakInput({ freezes: 1 }) })
      );

      expect(snapshot.summaries[1]!.streak).toMatchObject({
        weeks: 0,
        freezes: "1 zamrożenie w zapasie",
      });
    });

    it("counts weeks covered by automatic Pro freezes", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({
          streak: streakInput({ freezes: 2, autoFreezes: 2 }),
          qualifyingCompletedAt: ["2026-09-22T08:00:00"],
        })
      );
      const [, , second, third, fourth] = snapshot.summaries;

      expect(second!.streak).toMatchObject({
        title: "6 tygodni serii",
        freezes: "1 zamrożenie w zapasie",
      });
      expect(third!.streak).toMatchObject({
        title: "7 tygodni serii",
        freezes: null,
      });
      // The oldest missed week has no freeze left, so only the two covered
      // weeks remain in the streak.
      expect(fourth!.streak.title).toBe("2 tygodnie serii");
    });

    it("covers this week with a Pro freeze when it had no session", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({ streak: streakInput({ freezes: 1, autoFreezes: 1 }) })
      );

      expect(snapshot.summaries[1]!.streak.weeks).toBe(6);
    });

    it("raises the longest streak when covered weeks pass it", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({
          streak: streakInput({
            currentWeeks: 8,
            freezes: 3,
            autoFreezes: 3,
          }),
          qualifyingCompletedAt: ["2026-09-22T08:00:00"],
        })
      );

      expect(snapshot.summaries[3]!.streak).toMatchObject({
        weeks: 10,
        longest: "Najdłuższa: 10 tyg.",
      });
    });
  });

  describe("status", () => {
    it("asks signed-out users to sign in", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({ isSignedIn: false, queue: [] })
      );

      expect(snapshot.status).toBe("signedOut");
      expect(snapshot.message).toBe(
        "Zaloguj się w Sweaty, aby zobaczyć swoje treningi"
      );
    });

    it("asks users who have not finished onboarding to finish it", async () => {
      const snapshot = buildWidgetSnapshot(
        await input({ setupCompleted: false })
      );

      expect(snapshot.status).toBe("setupRequired");
      expect(snapshot.message).toBe("Dokończ konfigurację w Sweaty");
    });

    it("is ready without a status message otherwise", async () => {
      const snapshot = buildWidgetSnapshot(await input());

      expect(snapshot).toMatchObject({
        version: 1,
        status: "ready",
        message: null,
        language: "pl",
        generatedAt: NOW.toISOString(),
      });
      expect(snapshot.dayLetters).toEqual(["P", "W", "Ś", "C", "P", "S", "N"]);
    });
  });
});
