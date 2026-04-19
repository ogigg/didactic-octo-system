import { useEffect } from "react";
import * as Linking from "expo-linking";

import { useWorkoutStore } from "@/stores/workout-store";

/**
 * Parses query string from a sweaty:// URL without relying on Linking.parse,
 * whose handling of host vs. path varies across SDK versions.
 *
 * Examples it must handle:
 *   sweaty://workout?action=markSetDone&exerciseId=foo&setId=bar
 *   sweaty://workout/?action=markSetDone&...
 */
function parseQueryParams(url: string): Record<string, string> {
  const queryIndex = url.indexOf("?");
  if (queryIndex === -1) return {};
  const query = url.slice(queryIndex + 1);
  const out: Record<string, string> = {};
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq === -1) {
      out[decodeURIComponent(pair)] = "";
    } else {
      const key = decodeURIComponent(pair.slice(0, eq));
      const value = decodeURIComponent(pair.slice(eq + 1));
      out[key] = value;
    }
  }
  return out;
}

function applyMarkSetDone(exerciseId: string, setId: string): void {
  const { exercises, toggleSetComplete } = useWorkoutStore.getState();
  const exercise = exercises.find((e) => e.id === exerciseId);
  const set = exercise?.sets.find((s) => s.id === setId);
  // Idempotent: silently no-op for unknown or already-completed sets so a
  // duplicated URL delivery (getInitialURL + 'url' event, or rapid taps from
  // the Live Activity) doesn't toggle the set off again.
  if (!set || set.isCompleted) return;
  toggleSetComplete(exerciseId, setId);
}

function applySkipRest(): void {
  const { restTimer, skipRestTimer } = useWorkoutStore.getState();
  if (!restTimer) return;
  skipRestTimer();
}

function applyAdjustRest(rawDelta: string): void {
  const delta = Number.parseInt(rawDelta, 10);
  if (!Number.isFinite(delta) || delta === 0) return;
  const { restTimer, adjustRestTimer } = useWorkoutStore.getState();
  if (!restTimer) return;
  adjustRestTimer(delta);
}

function dispatchAction(params: Record<string, string>): void {
  switch (params.action) {
    case "markSetDone": {
      const { exerciseId, setId } = params;
      if (!exerciseId || !setId) return;
      applyMarkSetDone(exerciseId, setId);
      return;
    }
    case "skipRest":
      applySkipRest();
      return;
    case "adjustRest":
      if (!params.deltaSeconds) return;
      applyAdjustRest(params.deltaSeconds);
      return;
  }
}

/**
 * Global deep-link router for the Sweaty URL scheme. Mounted once at the
 * root layout so it survives screen unmounts and doesn't depend on the
 * workout screen being mounted at the moment iOS dispatches the URL.
 *
 * Currently handles:
 *   sweaty://workout?action=markSetDone&exerciseId=...&setId=...
 *     dispatched by the Live Activity "Mark set done" button (App Intent).
 */
export function useDeepLinks(): void {
  useEffect(() => {
    // De-dupe URLs across the cold-launch (getInitialURL) and warm-launch
    // ('url' event) paths. iOS may surface the same URL through both.
    const handled = new Set<string>();

    function process(rawUrl: string): void {
      if (handled.has(rawUrl)) return;
      handled.add(rawUrl);

      const params = parseQueryParams(rawUrl);
      if (!params.action) return;

      // Wait for the persisted workout store to hydrate before mutating.
      // On cold launch the URL may arrive before AsyncStorage has loaded
      // the active workout, in which case `exercises` is empty.
      const persist = useWorkoutStore.persist;
      if (persist.hasHydrated()) {
        dispatchAction(params);
        return;
      }
      const unsub = persist.onFinishHydration(() => {
        unsub();
        dispatchAction(params);
      });
    }

    Linking.getInitialURL()
      .then((url) => {
        if (url) process(url);
      })
      .catch(() => {
        /* getInitialURL is best-effort */
      });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      process(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
