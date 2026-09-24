import { useCallback, useState } from "react";

/**
 * State for a pull-to-refresh driven by the user: `refreshing` stays true
 * until `refresh` settles, and is cleared even if it rejects.
 */
export function useManualRefresh(refresh: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  return { refreshing, onRefresh };
}
