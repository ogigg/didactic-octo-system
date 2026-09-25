jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

import { renderHook } from "@testing-library/react-native";

import { useChartScrub } from "../use-chart-scrub";

const points = [
  { x: 10, y: 0 },
  { x: 50, y: 0 },
];

describe("useChartScrub", () => {
  it("keeps the gesture when the parent passes new callbacks", () => {
    const { result, rerender } = renderHook(
      ({ onTap }: { onTap: (index: number) => void }) =>
        useChartScrub(points, { onTap, onScrubEnd: onTap }),
      { initialProps: { onTap: jest.fn() } }
    );
    const gesture = result.current.gesture;

    rerender({ onTap: jest.fn() });

    expect(result.current.gesture).toBe(gesture);
  });
});
