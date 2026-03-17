export interface WorkoutSession {
  title: string;
}

export interface DayEntry {
  date: string; // ISO format: YYYY-MM-DD
  sessions: WorkoutSession[];
}

export const MOCK_ENTRIES: DayEntry[] = [
  // March 2026
  { date: "2026-03-17", sessions: [{ title: "Upper Body" }] },
  { date: "2026-03-15", sessions: [{ title: "Leg Day" }, { title: "Core" }] },
  { date: "2026-03-12", sessions: [{ title: "Pull Day" }] },
  {
    date: "2026-03-10",
    sessions: [
      { title: "Push Day" },
      { title: "Cardio" },
      { title: "Stretching" },
    ],
  },
  { date: "2026-03-07", sessions: [{ title: "Full Body" }] },
  {
    date: "2026-03-03",
    sessions: [{ title: "Back & Biceps" }, { title: "Core" }],
  },
  { date: "2026-03-01", sessions: [{ title: "Chest & Triceps" }] },

  // February 2026
  { date: "2026-02-25", sessions: [{ title: "Leg Day" }] },
  {
    date: "2026-02-22",
    sessions: [{ title: "Upper Body" }, { title: "HIIT" }],
  },
  { date: "2026-02-18", sessions: [{ title: "Pull Day" }] },
  { date: "2026-02-14", sessions: [{ title: "Full Body" }] },
  { date: "2026-02-10", sessions: [{ title: "Push Day" }, { title: "Core" }] },
  { date: "2026-02-05", sessions: [{ title: "Back & Biceps" }] },
  { date: "2026-02-01", sessions: [{ title: "Cardio" }] },

  // January 2026
  { date: "2026-01-28", sessions: [{ title: "Leg Day" }, { title: "Core" }] },
  { date: "2026-01-24", sessions: [{ title: "Upper Body" }] },
  { date: "2026-01-20", sessions: [{ title: "Pull Day" }] },
  {
    date: "2026-01-15",
    sessions: [{ title: "Push Day" }, { title: "Cardio" }],
  },
  { date: "2026-01-10", sessions: [{ title: "Full Body" }] },
  { date: "2026-01-05", sessions: [{ title: "Back & Biceps" }] },
];

export function getEntriesForMonth(year: number, month: number): DayEntry[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return MOCK_ENTRIES.filter((entry) => entry.date.startsWith(prefix));
}
