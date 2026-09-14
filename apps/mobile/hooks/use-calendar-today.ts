import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { getCalendarDateKey } from "@/lib/streak-calendar";

/** Refresh at local midnight and on resume (including timezone changes). */
export function useCalendarToday(): string {
  const [today, setToday] = useState(() => getCalendarDateKey(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      const now = new Date();
      setToday(getCalendarDateKey(now));
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1
      );
      timer = setTimeout(refresh, midnight.getTime() - now.getTime());
    };
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return today;
}
