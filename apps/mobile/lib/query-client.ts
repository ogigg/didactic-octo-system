import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

// React Native has no window focus events: treat returning to the foreground
// as focus, so stale queries refetch on resume (web keeps TanStack's default).
if (Platform.OS !== "web") {
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener("change", (state) => {
      handleFocus(state === "active");
    });
    return () => subscription.remove();
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
    },
    mutations: {
      retry: false,
    },
  },
});
