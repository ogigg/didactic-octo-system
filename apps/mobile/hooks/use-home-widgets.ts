import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppState } from "react-native";

import { useAuth } from "@/hooks/use-auth";
import { useCalendarToday } from "@/hooks/use-calendar-today";
import { useLocalizedExerciseMap } from "@/hooks/use-exercises-query";
import { useProfile } from "@/hooks/use-profile-query";
import { useStreakStatus } from "@/hooks/use-streak-protection";
import { useWorkoutQueueData } from "@/hooks/use-workout-queue";
import { useWorkoutStats } from "@/hooks/use-workout-stats";
import { normalizeLanguage } from "@/i18n";
import { fetchStreakCalendarData } from "@/lib/api/streak-calendar";
import {
  fetchWeeklyDurations,
  fetchWorkoutHistoryPage,
} from "@/lib/api/workouts";
import {
  CONSISTENCY_WEEKS,
  TRAINING_TIME_WEEKS,
} from "@/lib/home-widgets/activity";
import {
  buildWidgetSnapshot,
  resolvePendingWorkoutExercises,
  type WidgetSnapshotInput,
} from "@/lib/home-widgets/build-snapshot";
import { homeWidgetKeys } from "@/lib/query-keys";
import { getCalendarDateKey } from "@/lib/streak-calendar";
import { getWindowStart } from "@/lib/weekly-activity";
import {
  clearWidgetSnapshot,
  hasInstalledHomeWidgets,
  setWidgetSnapshot,
} from "@/modules/home-widgets/src";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { selectNextWorkout } from "@/stores/pending-workout-store";
import { useWorkoutStore } from "@/stores/workout-store";

const PUBLISH_DELAY_MS = 300;
const PUBLISH_RETRY_MS = 5_000;

function dateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function useWorkoutStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() =>
    useWorkoutStore.persist.hasHydrated()
  );

  useEffect(() => {
    if (hydrated) return;
    const unsubscribe = useWorkoutStore.persist.onFinishHydration(() =>
      setHydrated(true)
    );
    // Hydration can finish between the first render and this subscription.
    if (useWorkoutStore.persist.hasHydrated()) setHydrated(true);
    return unsubscribe;
  }, [hydrated]);

  return hydrated;
}

/**
 * Whether the user has placed any Sweaty widget, re-checked whenever the app
 * returns to the foreground. Without widgets the snapshot is cleared, so a
 * widget added later never shows an earlier account's data before the app
 * publishes again.
 */
export function useHasInstalledHomeWidgets(): boolean {
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      hasInstalledHomeWidgets()
        .then((next) => {
          if (cancelled) return;
          setInstalled(next);
          if (!next) void clearWidgetSnapshot().catch(() => {});
        })
        .catch((error) => {
          console.warn("Home widget configuration check failed:", error);
        });
    };
    check();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return installed;
}

/**
 * Keeps the iOS Home Screen and Lock Screen widgets in sync with the app.
 * Mounted by `components/home-widgets-host.tsx` only on iOS and only while a
 * widget is placed, so none of these queries run otherwise.
 */
export function useHomeWidgets(): void {
  const { user, isInitialized } = useAuth();
  const { t, i18n } = useTranslation("widgets");
  const language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  const todayKey = useCalendarToday();
  const workoutStoreHydrated = useWorkoutStoreHydrated();
  const isWorkoutActive = useWorkoutStore((s) => s.isActive);
  const activeWorkoutName = useWorkoutStore((s) => s.workoutName);
  const workoutOwnerUserId = useWorkoutStore((s) => s.ownerUserId);
  // Same source the tab layout uses to decide between onboarding and home.
  const onboardingCompleted = useOnboardingStore((s) => s.isCompleted);

  const profileQuery = useProfile();
  const queueQuery = useWorkoutQueueData();
  const streakQuery = useStreakStatus();
  const { totalWorkouts, streakWeeks } = useWorkoutStats();

  const windows = useMemo(() => {
    const today = dateFromKey(todayKey);
    return {
      consistencyStart: getWindowStart(today, CONSISTENCY_WEEKS),
      trainingTimeStart: getWindowStart(today, TRAINING_TIME_WEEKS),
    };
  }, [todayKey]);

  const activityQuery = useQuery({
    queryKey: homeWidgetKeys.activity(
      getCalendarDateKey(windows.consistencyStart)
    ),
    queryFn: async () => {
      const [calendar, durations] = await Promise.all([
        fetchStreakCalendarData(
          windows.consistencyStart.toISOString(),
          new Date().toISOString()
        ),
        fetchWeeklyDurations(windows.trainingTimeStart.toISOString()),
      ]);
      return {
        qualifyingCompletedAt: calendar.qualifyingCompletedAtDates,
        sessionDurations: durations,
      };
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const lastWorkoutQuery = useQuery({
    queryKey: homeWidgetKeys.lastWorkout(),
    queryFn: () => fetchWorkoutHistoryPage(1),
    enabled: !!user,
    staleTime: 60_000,
  });

  const nextWorkout = selectNextWorkout(queueQuery.queue);
  const exerciseIds = useMemo(
    () =>
      nextWorkout
        ? resolvePendingWorkoutExercises(nextWorkout).map(
            (exercise) => exercise.exercise_id
          )
        : [],
    [nextWorkout]
  );
  const { exerciseMap } = useLocalizedExerciseMap(exerciseIds);

  const profile = profileQuery.data;
  const activity = activityQuery.data;
  const lastWorkout = lastWorkoutQuery.data?.[0] ?? null;
  const streakStatus = streakQuery.data;

  // Serialized once per content change; `contentKey` leaves out the timestamp
  // so identical content is published only once.
  const published = useMemo(() => {
    if (!isInitialized || !workoutStoreHydrated) return null;

    const base: Omit<WidgetSnapshotInput, "isSignedIn" | "setupCompleted"> = {
      now: new Date(),
      language,
      t,
      weeklyFrequency: profile?.weekly_frequency,
      queue: queueQuery.queue,
      // Auth setup clears another account's workout; this covers the moment
      // before it runs.
      activeWorkoutName:
        isWorkoutActive && user && workoutOwnerUserId === user.id
          ? activeWorkoutName
          : null,
      localizeExerciseName: (id, fallback) =>
        exerciseMap.get(id)?.name ?? fallback,
      streak: streakStatus
        ? {
            currentWeeks: streakWeeks ?? streakStatus.current_streak_weeks,
            longestWeeks: streakStatus.longest_streak_weeks,
            freezes:
              streakStatus.earned_freezes_available +
              streakStatus.pro_freezes_available,
          }
        : streakWeeks !== null
          ? { currentWeeks: streakWeeks, longestWeeks: 0, freezes: 0 }
          : null,
      qualifyingCompletedAt: activity?.qualifyingCompletedAt ?? [],
      sessionDurations: activity?.sessionDurations ?? [],
      totalWorkouts,
      lastWorkout: lastWorkout
        ? {
            name: lastWorkout.name,
            startedAt: lastWorkout.started_at,
            completedAt: lastWorkout.completed_at,
          }
        : null,
    };

    let input: WidgetSnapshotInput;
    if (!user) {
      input = {
        ...base,
        isSignedIn: false,
        setupCompleted: false,
        queue: [],
        activeWorkoutName: null,
        streak: null,
        qualifyingCompletedAt: [],
        sessionDurations: [],
        totalWorkouts: null,
        lastWorkout: null,
      };
    } else if (!profile || !queueQuery.isSuccess || !activity) {
      // Keep the previous snapshot until the essentials load, so the widget
      // never flashes an empty queue while the app is starting.
      return null;
    } else {
      // A new calendar day moves the activity query key, which rebuilds this.
      input = {
        ...base,
        isSignedIn: true,
        setupCompleted: onboardingCompleted,
      };
    }

    try {
      const snapshot = buildWidgetSnapshot(input);
      return {
        json: JSON.stringify(snapshot),
        contentKey: JSON.stringify({ ...snapshot, generatedAt: null }),
      };
    } catch (error) {
      // The widget is optional: unexpected data must never break the app.
      console.warn("Home widget snapshot build failed:", error);
      return null;
    }
  }, [
    activeWorkoutName,
    activity,
    exerciseMap,
    isInitialized,
    isWorkoutActive,
    language,
    lastWorkout,
    onboardingCompleted,
    profile,
    queueQuery.isSuccess,
    queueQuery.queue,
    streakStatus,
    streakWeeks,
    t,
    totalWorkouts,
    user,
    workoutOwnerUserId,
    workoutStoreHydrated,
  ]);

  const publishedKeyRef = useRef<string | null>(null);
  // Bumped to retry a failed publish and to republish on every resume, so the
  // widget recovers even when nothing in the app changed.
  const [publishAttempt, setPublishAttempt] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      publishedKeyRef.current = null;
      setPublishAttempt((attempt) => attempt + 1);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!published || published.contentKey === publishedKeyRef.current) {
      return;
    }

    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      publishedKeyRef.current = published.contentKey;
      setWidgetSnapshot(published.json).catch((error) => {
        console.warn("Home widget snapshot publish failed:", error);
        publishedKeyRef.current = null;
        retryTimer = setTimeout(
          () => setPublishAttempt((attempt) => attempt + 1),
          PUBLISH_RETRY_MS
        );
      });
    }, PUBLISH_DELAY_MS);

    return () => {
      clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [published, publishAttempt]);
}
