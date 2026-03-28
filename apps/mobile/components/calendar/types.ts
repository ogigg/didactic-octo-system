export interface WorkoutSession {
  title: string;
}

export interface DayEntry {
  date: string; // ISO format: YYYY-MM-DD
  sessions: WorkoutSession[];
}
