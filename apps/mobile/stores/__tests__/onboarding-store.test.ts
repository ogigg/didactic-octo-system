// Mock AsyncStorage so tests don't touch the real storage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import { act, renderHook } from "@testing-library/react-native";
import { useOnboardingStore } from "../onboarding-store";

// Reset store between tests so state doesn't leak
beforeEach(() => {
  useOnboardingStore.getState().reset();
});

describe("initial state", () => {
  it("starts with all fields null and not completed", () => {
    const { result } = renderHook(() => useOnboardingStore());
    expect(result.current.gender).toBeNull();
    expect(result.current.genderSkipped).toBe(false);
    expect(result.current.goal).toBeNull();
    expect(result.current.customGoal).toBeNull();
    expect(result.current.frequency).toBeNull();
    expect(result.current.isCompleted).toBe(false);
  });
});

describe("setGender", () => {
  it("sets the gender and does not set genderSkipped", () => {
    const { result } = renderHook(() => useOnboardingStore());
    act(() => result.current.setGender("male"));
    expect(result.current.gender).toBe("male");
    expect(result.current.genderSkipped).toBe(false);
  });
});

describe("skipGender", () => {
  it("sets genderSkipped to true and keeps gender null", () => {
    const { result } = renderHook(() => useOnboardingStore());
    act(() => result.current.skipGender());
    expect(result.current.gender).toBeNull();
    expect(result.current.genderSkipped).toBe(true);
  });
});

describe("setGoal", () => {
  it("sets goal and clears customGoal", () => {
    const { result } = renderHook(() => useOnboardingStore());
    act(() => result.current.setCustomGoal("my custom goal"));
    act(() => result.current.setGoal("build_strength"));
    expect(result.current.goal).toBe("build_strength");
    expect(result.current.customGoal).toBeNull();
  });
});

describe("setCustomGoal", () => {
  it("sets customGoal and clears goal", () => {
    const { result } = renderHook(() => useOnboardingStore());
    act(() => result.current.setGoal("lose_weight"));
    act(() => result.current.setCustomGoal("muscle up in 6 months"));
    expect(result.current.customGoal).toBe("muscle up in 6 months");
    expect(result.current.goal).toBeNull();
  });

  it("setting empty string clears customGoal", () => {
    const { result } = renderHook(() => useOnboardingStore());
    act(() => result.current.setCustomGoal("something"));
    act(() => result.current.setCustomGoal(""));
    expect(result.current.customGoal).toBeNull();
  });
});

describe("setFrequency", () => {
  it("stores the frequency value", () => {
    const { result } = renderHook(() => useOnboardingStore());
    act(() => result.current.setFrequency(4));
    expect(result.current.frequency).toBe(4);
  });

  it("stores 5 for the 5+ option", () => {
    const { result } = renderHook(() => useOnboardingStore());
    act(() => result.current.setFrequency(5));
    expect(result.current.frequency).toBe(5);
  });
});

describe("complete", () => {
  it("sets isCompleted to true", () => {
    const { result } = renderHook(() => useOnboardingStore());
    act(() => result.current.complete());
    expect(result.current.isCompleted).toBe(true);
  });
});

describe("reset", () => {
  it("restores initial state", () => {
    const { result } = renderHook(() => useOnboardingStore());
    act(() => {
      result.current.setGender("female");
      result.current.setFrequency(3);
      result.current.complete();
    });
    act(() => result.current.reset());
    expect(result.current.gender).toBeNull();
    expect(result.current.frequency).toBeNull();
    expect(result.current.isCompleted).toBe(false);
  });
});

describe("getNextUnfinishedStep", () => {
  it("returns gender when nothing is answered", () => {
    const { result } = renderHook(() => useOnboardingStore());
    expect(result.current.getNextUnfinishedStep()).toBe("gender");
  });

  it("returns goal after gender is answered", () => {
    const { result } = renderHook(() => useOnboardingStore());
    act(() => result.current.setGender("male"));
    expect(result.current.getNextUnfinishedStep()).toBe("goal");
  });

  it("returns goal after gender is skipped (not left unanswered)", () => {
    const { result } = renderHook(() => useOnboardingStore());
    act(() => result.current.skipGender());
    expect(result.current.getNextUnfinishedStep()).toBe("goal");
  });

  it("returns frequency after goal is answered", () => {
    const { result } = renderHook(() => useOnboardingStore());
    act(() => {
      result.current.skipGender();
      result.current.setGoal("lose_weight");
    });
    expect(result.current.getNextUnfinishedStep()).toBe("frequency");
  });

  it("returns review after all steps are answered", () => {
    const { result } = renderHook(() => useOnboardingStore());
    act(() => {
      result.current.skipGender();
      result.current.setGoal("build_strength");
      result.current.setFrequency(3);
    });
    expect(result.current.getNextUnfinishedStep()).toBe("review");
  });

  it("returns null when completed", () => {
    const { result } = renderHook(() => useOnboardingStore());
    act(() => result.current.complete());
    expect(result.current.getNextUnfinishedStep()).toBeNull();
  });
});
