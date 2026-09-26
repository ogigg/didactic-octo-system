import { eraseActiveWorkoutForUser } from "@/lib/active-workout-owner";
import { syncQueue } from "@/lib/sync-queue";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { usePendingWorkoutStore } from "@/stores/pending-workout-store";
import {
  eraseWorkoutTemplatesForUser,
  useWorkoutTemplatesStore,
} from "@/stores/workout-templates-store";
import { waitForWorkoutStorePersistence } from "@/stores/workout-store";

interface PersistApi {
  hasHydrated: () => boolean;
  rehydrate: () => Promise<void> | void;
}

async function ensureHydrated(persist: PersistApi | undefined): Promise<void> {
  // `persist` is absent under the Jest middleware mock.
  if (persist && !persist.hasHydrated()) await persist.rehydrate();
}

/**
 * Points account-scoped local data at the signed-in account. Call it
 * synchronously on every account change, sign-out included, so the previous
 * account's templates and queue-generation context leave memory at once.
 *
 * The active workout and onboarding draft stay tagged with their owner and are
 * claimed or cleared during profile setup, after they finish loading.
 */
export function switchLocalAccountData(userId: string | null): void {
  useWorkoutTemplatesStore.getState().setOwner(userId);
  usePendingWorkoutStore.getState().prepareForUser(userId);
}

/**
 * Removes everything this device keeps for an account whose erasure is
 * confirmed: templates, queued writes, the active workout and summary, the
 * onboarding draft and queue-generation context. Other accounts' data stays.
 *
 * Call it after the erased account has signed out. A plain sign-out must not
 * call it: the account's unsynced workouts and templates wait for its return.
 */
export async function eraseLocalAccountData(userId: string): Promise<void> {
  await Promise.all([
    ensureHydrated(useOnboardingStore.persist),
    ensureHydrated(usePendingWorkoutStore.persist),
  ]);
  if (useOnboardingStore.getState().ownerUserId === userId) {
    useOnboardingStore.getState().reset();
  }
  if (usePendingWorkoutStore.getState().ownerUserId === userId) {
    usePendingWorkoutStore.getState().prepareForUser(null);
  }

  await Promise.all([
    eraseWorkoutTemplatesForUser(userId),
    syncQueue.removeOwner(userId),
    eraseActiveWorkoutForUser(userId),
  ]);
  await waitForWorkoutStorePersistence();
}
