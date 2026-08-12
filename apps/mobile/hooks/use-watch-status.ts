import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

import {
  isWatchAppInstalled,
  isWatchPaired,
  isWatchReachable,
  refreshWatchStatus,
} from "@/modules/watch-bridge/src";

export interface WatchStatus {
  platformSupported: boolean;
  paired: boolean;
  installed: boolean;
  reachable: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Reads WatchConnectivity state on focus and whenever the app becomes active.
 * The initial loading state prevents pre-activation false values from being
 * presented as a disconnected Watch.
 */
export function useWatchStatus(): WatchStatus {
  const platformSupported = Platform.OS === "ios";
  const [paired, setPaired] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [reachable, setReachable] = useState(false);
  const [loading, setLoading] = useState(platformSupported);

  const refresh = useCallback(async () => {
    if (!platformSupported) {
      setPaired(false);
      setInstalled(false);
      setReachable(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const status = await refreshWatchStatus();
      setPaired(status.paired);
      setInstalled(status.installed);
      setReachable(status.reachable);
    } catch {
      // Keep the last known status when native activation is still in flight.
      // This is an ordinary transient state, not a user-facing error.
      setPaired(isWatchPaired());
      setInstalled(isWatchAppInstalled());
      setReachable(isWatchReachable());
    } finally {
      setLoading(false);
    }
  }, [platformSupported]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return {
    platformSupported,
    paired,
    installed,
    reachable,
    loading,
    refresh,
  };
}
