export interface WorkoutSession {
  id: string;
  title: string;
}

export interface DayEntry {
  date: string; // ISO format: YYYY-MM-DD
  sessions: WorkoutSession[];
}
