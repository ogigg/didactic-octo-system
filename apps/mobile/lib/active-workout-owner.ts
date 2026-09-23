import { publishCancelledWorkoutToWatch } from "@/lib/watch-workout-publisher";
import {
  isOwnedByAnotherUser,
  useWorkoutStore,
  waitForWorkoutStoreHydration,
} from "@/stores/workout-store";

/**
 * Hands the persisted workout to the signed-in account. Another account's
 * workout is cancelled on the Watch and cleared, so it never shows on the home
 * screen, the Live Activity or the widgets, or gets saved to the wrong account.
 */
export async function prepareActiveWorkoutForUser(
  userId: string
): Promise<void> {
  // Claiming before hydration would let the restored workout overwrite it.
  await waitForWorkoutStoreHydration();
  const state = useWorkoutStore.getState();
  if (state.isActive && isOwnedByAnotherUser(state, userId)) {
    // Same order as discarding on the workout screen: once the phone is idle,
    // nothing else tells the Watch the workout ended.
    await publishCancelledWorkoutToWatch(state).catch((error: unknown) => {
      console.warn("[active-workout-owner] Watch cancel failed:", error);
    });
  }
  useWorkoutStore.getState().prepareForUser(userId);
}
