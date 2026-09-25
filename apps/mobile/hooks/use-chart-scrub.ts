import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import { Gesture } from "react-native-gesture-handler";

import { findNearestPointIndex, type ChartPoint } from "@/lib/chart-geometry";

interface ChartScrubOptions {
  /** The point the finger was on when a drag ended. */
  onScrubEnd?: (index: number) => void;
  /** The point nearest to a tap. */
  onTap?: (index: number) => void;
}

/**
 * Drag horizontally across a line chart to inspect the nearest point, or tap
 * to pick one. A mostly vertical drag fails the pan, so the screen's
 * ScrollView keeps scrolling when the swipe starts on the chart.
 */
export function useChartScrub(
  points: readonly ChartPoint[],
  { onScrubEnd, onTap }: ChartScrubOptions = {}
) {
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const lastIndex = useRef<number | null>(null);
  // Read the latest callbacks through a ref, so a parent passing new
  // functions on every render doesn't rebuild the gesture (even mid-drag).
  const callbacks = useRef({ onScrubEnd, onTap });
  useEffect(() => {
    callbacks.current = { onScrubEnd, onTap };
  });

  const gesture = useMemo(() => {
    const scrubTo = (x: number) => {
      const index = findNearestPointIndex(points, x);
      if (index < 0 || index === lastIndex.current) return;
      lastIndex.current = index;
      setScrubIndex(index);
      void Haptics.selectionAsync().catch(() => {});
    };

    const pan = Gesture.Pan()
      .runOnJS(true)
      .withTestId("chart-scrub")
      .activeOffsetX([-6, 6])
      .failOffsetY([-12, 12])
      .onStart(({ x }) => scrubTo(x))
      .onUpdate(({ x }) => scrubTo(x))
      .onFinalize(() => {
        // Also runs when the pan never activated (a tap or a vertical scroll).
        if (lastIndex.current !== null) {
          callbacks.current.onScrubEnd?.(lastIndex.current);
        }
        lastIndex.current = null;
        setScrubIndex(null);
      });

    // Without a distance limit, a quick scroll flick over the chart ends as a tap.
    const tap = Gesture.Tap()
      .runOnJS(true)
      .withTestId("chart-tap")
      .maxDistance(10)
      .onEnd(({ x }) => {
        const index = findNearestPointIndex(points, x);
        if (index >= 0) callbacks.current.onTap?.(index);
      });

    return Gesture.Race(pan, tap);
  }, [points]);

  return { gesture, scrubIndex };
}
