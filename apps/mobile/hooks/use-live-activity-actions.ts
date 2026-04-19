import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import {
  drainPendingActions,
  type PendingLiveActivityAction,
} from "@/modules/workout-live-activity/src";
import { useWorkoutStore } from "@/stores/workout-store";

/**
 * Drains the App-Group action queue published by the Live Activity widget
 * App Intents (Skip Rest, Adjust Rest, …) and applies each action to the
 * Zustand workout store.
 *
 * The widget intents update the activity surface optimistically and park a
 * payload in shared `UserDefaults`. We pick those up on:
 *   - mount (catch anything queued while the app was suspended)
 *   - every transition to `AppState.active` (lock-screen tap → app open path)
 *   - persist hydration finish (if first interaction lands before AsyncStorage
 *     has rehydrated the workout)
 *
 * Reconciliation is idempotent: after applying actions, the existing
 * `useWorkoutLiveActivity` push loop re-syncs the canonical store state into
 * the activity, overwriting any drift from the optimistic widget update.
 */
export function useLiveActivityActions(): void {
  useEffect(() => {
    if (Platform.OS !== "ios") return;

    let cancelled = false;

    async function drainAndApply(): Promise<void> {
      try {
        const actions = await drainPendingActions();
        if (cancelled || actions.length === 0) return;
        for (const action of actions) {
          applyAction(action);
        }
      } catch (error) {
        console.warn("[live-activity] drain failed:", error);
      }
    }

    function drainAfterHydration(): void {
      const persist = useWorkoutStore.persist;
      if (persist.hasHydrated()) {
        drainAndApply();
        return;
      }
      const unsub = persist.onFinishHydration(() => {
        unsub();
        drainAndApply();
      });
    }

    drainAfterHydration();

    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") drainAndApply();
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}

function applyAction(action: PendingLiveActivityAction): void {
  const store = useWorkoutStore.getState();
  // Guard each branch on the store still being in the expected shape so
  // stale actions (e.g. workout already ended, rest already cleared) become
  // silent no-ops rather than corrupting state.
  switch (action.type) {
    case "skipRest": {
      if (store.restTimer) store.skipRestTimer();
      return;
    }
    case "adjustRest": {
      if (store.restTimer) store.adjustRestTimer(action.deltaSeconds);
      return;
    }
  }
}
