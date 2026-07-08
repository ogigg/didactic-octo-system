import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";

const COMEBACK_WORKOUT_MARKER_KEY = "comeback-workout-marker";

const comebackWorkoutMarkerSchema = z.object({
  promptState: z.string(),
  startedAtMs: z.number(),
  hadReadyWorkout: z.boolean(),
});

export type ComebackWorkoutMarker = z.infer<typeof comebackWorkoutMarkerSchema>;

export async function markComebackWorkoutStarted(
  marker: ComebackWorkoutMarker
): Promise<void> {
  await AsyncStorage.setItem(
    COMEBACK_WORKOUT_MARKER_KEY,
    JSON.stringify(marker)
  );
}

export async function consumeComebackWorkoutMarker(): Promise<ComebackWorkoutMarker | null> {
  const raw = await AsyncStorage.getItem(COMEBACK_WORKOUT_MARKER_KEY);
  await AsyncStorage.removeItem(COMEBACK_WORKOUT_MARKER_KEY);

  if (!raw) {
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  const parsed = comebackWorkoutMarkerSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
