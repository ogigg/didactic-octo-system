import { act, renderHook } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { useCalendarToday } from "../use-calendar-today";

let resume: (state: AppStateStatus) => void;
const remove = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 8, 30, 23, 59, 59));
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_event, listener) => {
      resume = listener;
      return { remove };
    });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("moves today across midnight and the month boundary while mounted", () => {
  const { result, unmount } = renderHook(() => useCalendarToday());
  expect(result.current).toBe("2026-09-30");
  act(() => {
    jest.advanceTimersByTime(1000);
  });
  expect(result.current).toBe("2026-10-01");
  unmount();
  expect(jest.getTimerCount()).toBe(0);
  expect(remove).toHaveBeenCalled();
});

it("updates on resume after the app slept through midnight", () => {
  const { result, unmount } = renderHook(() => useCalendarToday());
  jest.setSystemTime(new Date(2026, 9, 2, 10));
  act(() => {
    resume("active");
  });
  expect(result.current).toBe("2026-10-02");
  unmount();
});
