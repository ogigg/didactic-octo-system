import AsyncStorage from "@react-native-async-storage/async-storage";

import { publishCancelledWorkoutToWatch } from "@/lib/watch-workout-publisher";
import {
  mustDiscardWorkoutForUser,
  useWorkoutStore,
  waitForWorkoutStoreHydration,
  waitForWorkoutStorePersistence,
  WORKOUT_STORAGE_KEY,
} from "@/stores/workout-store";

export const WATCH_CANCEL_TIMEOUT_MS = 3_000;

/**
 * Copy of a workout saved before workouts had an owner. No account can claim
 * it, so it is set aside here and never read by the app.
 */
export const UNOWNED_WORKOUT_QUARANTINE_KEY = `${WORKOUT_STORAGE_KEY}:unowned`;

// Same order as discarding on the workout screen: once the phone is idle,
// nothing else tells the Watch the workout ended. Callers wait for it only
// briefly, since Watch messages queue behind earlier sends.
async function cancelActiveWorkoutOnWatch(): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    publishCancelledWorkoutToWatch(useWorkoutStore.getState()).catch(
      (error: unknown) => {
        console.warn("[active-workout-owner] Watch cancel failed:", error);
      }
    ),
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, WATCH_CANCEL_TIMEOUT_MS);
    }),
  ]);
  clearTimeout(timeout);
}

// Best effort: the unowned workout still leaves the app if this fails, since
// showing it to the signed-in account is the worse outcome.
async function quarantineUnownedWorkout(): Promise<void> {
  try {
    await waitForWorkoutStorePersistence();
    // Only builds from before workout ownership left unowned workouts, so
    // an existing copy is never replaced.
    if ((await AsyncStorage.getItem(UNOWNED_WORKOUT_QUARANTINE_KEY)) !== null)
      return;
    const saved = await AsyncStorage.getItem(WORKOUT_STORAGE_KEY);
    if (saved !== null) {
      await AsyncStorage.setItem(UNOWNED_WORKOUT_QUARANTINE_KEY, saved);
    }
  } catch (error) {
    console.warn("[active-workout-owner] quarantine failed:", error);
  }
}

/**
 * Hands the persisted workout to the signed-in account. Another account's
 * workout, or an unowned one from before workouts had an owner, is cancelled
 * on the Watch and cleared, so it never shows on the home screen, the Live
 * Activity or the widgets, or gets saved to the wrong account.
 */
export async function prepareActiveWorkoutForUser(
  userId: string
): Promise<void> {
  // Claiming before hydration would let the restored workout overwrite it.
  await waitForWorkoutStoreHydration();
  const state = useWorkoutStore.getState();
  if (mustDiscardWorkoutForUser(state, userId)) {
    if (state.ownerUserId === null) await quarantineUnownedWorkout();
    if (state.isActive) await cancelActiveWorkoutOnWatch();
  }
  useWorkoutStore.getState().prepareForUser(userId);
}

/**
 * Clears the account's persisted workout and summary for confirmed account
 * erasure. Unsynced writes live in the sync queue, not here.
 */
export async function eraseActiveWorkoutForUser(userId: string): Promise<void> {
  await waitForWorkoutStoreHydration();
  if (useWorkoutStore.getState().ownerUserId !== userId) return;
  if (useWorkoutStore.getState().isActive) await cancelActiveWorkoutOnWatch();
  // The workout could have changed hands while the Watch was notified.
  if (useWorkoutStore.getState().ownerUserId !== userId) return;
  useWorkoutStore.getState().clearWorkout({ suppressAbandonment: true });
  useWorkoutStore.setState({ ownerUserId: null });
}
