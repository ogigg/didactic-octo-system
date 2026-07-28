import { act } from "@testing-library/react-native";

import { useToastStore } from "../toast-store";

beforeEach(() => {
  jest.useFakeTimers();
  useToastStore.getState().dismiss();
});

afterEach(() => {
  useToastStore.getState().dismiss();
  jest.useRealTimers();
});

describe("toast store", () => {
  it("shows success feedback and dismisses it automatically", () => {
    act(() => {
      useToastStore.getState().showSuccess("Workout deleted.");
    });

    expect(useToastStore.getState().toast).toEqual(
      expect.objectContaining({
        message: "Workout deleted.",
        tone: "success",
      })
    );

    act(() => {
      jest.advanceTimersByTime(2500);
    });

    expect(useToastStore.getState().toast).toBeNull();
  });
});
