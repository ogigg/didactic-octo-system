import type { ExerciseSessionHistory } from "@/lib/api/exercise-detail";

/** The detail endpoint returns at most 50 recent exercise performances. */
export function getExerciseInsights(
  history: ExerciseSessionHistory[],
  isTime: boolean,
  now = new Date()
) {
  const sessions = history
    .filter(
      (session) =>
        session.sets?.length &&
        Number.isFinite(Date.parse(session.date)) &&
        session.date.slice(0, 10) <= now.toISOString().slice(0, 10)
    )
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const dayNumber = (date: string) =>
    Math.floor(Date.parse(date.slice(0, 10)) / 86400000);
  const today = dayNumber(now.toISOString());
  const oldest = sessions.at(-1);
  const days = new Set(sessions.map((session) => dayNumber(session.date)));
  const activity = [30, 90].map((period) => ({
    period,
    count: [...days].filter((day) => day > today - period).length,
    incomplete:
      history.length >= 50 &&
      !!oldest &&
      dayNumber(oldest.date) > today - period,
  }));
  const total = (session: ExerciseSessionHistory) =>
    (session.sets ?? []).reduce(
      (sum, set) =>
        sum +
        (isTime
          ? Math.max(0, set.duration_seconds ?? 0)
          : Math.max(0, set.load_kg ?? 0) * Math.max(0, set.reps ?? 0)),
      0
    );
  const latestFive = sessions.slice(0, 5);
  const previousFive = sessions.slice(5, 10);
  const average = (items: ExerciseSessionHistory[]) =>
    items.reduce((sum, item) => sum + total(item), 0) / items.length;
  const comparison =
    previousFive.length === 5
      ? {
          recent: average(latestFive),
          previous: average(previousFive),
        }
      : null;
  const latest = sessions[0];
  let progress: {
    load: number | null;
    previous: number;
    recent: number;
    previousDate: string;
    recentDate: string;
  } | null = null;
  if (latest) {
    for (const previous of sessions.slice(1)) {
      if (isTime) {
        const recentDuration = Math.max(
          0,
          ...(latest.sets ?? []).map((set) => set.duration_seconds ?? 0)
        );
        const previousDuration = Math.max(
          0,
          ...(previous.sets ?? []).map((set) => set.duration_seconds ?? 0)
        );
        if (recentDuration > 0 && previousDuration > 0) {
          progress = {
            load: null,
            previous: previousDuration,
            recent: recentDuration,
            previousDate: previous.date,
            recentDate: latest.date,
          };
          break;
        }
      } else {
        const latestSets = (latest.sets ?? []).filter(
          (set) =>
            set.load_kg != null && set.load_kg >= 0 && (set.reps ?? 0) > 0
        );
        const previousSets = (previous.sets ?? []).filter(
          (set) =>
            set.load_kg != null && set.load_kg >= 0 && (set.reps ?? 0) > 0
        );
        const sharedLoads = latestSets
          .map((set) => set.load_kg!)
          .filter((load) => previousSets.some((set) => set.load_kg === load));
        if (sharedLoads.length) {
          const load = Math.max(...sharedLoads);
          progress = {
            load,
            previous: Math.max(
              ...previousSets
                .filter((set) => set.load_kg === load)
                .map((set) => set.reps!)
            ),
            recent: Math.max(
              ...latestSets
                .filter((set) => set.load_kg === load)
                .map((set) => set.reps!)
            ),
            previousDate: previous.date,
            recentDate: latest.date,
          };
          break;
        }
      }
    }
  }
  return {
    sessionCount: sessions.length,
    activity,
    comparison,
    progress,
    daysSinceLast: latest ? today - dayNumber(latest.date) : null,
  };
}
