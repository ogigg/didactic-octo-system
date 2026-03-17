import { containsProfanity, MAX_CUSTOM_GOAL_LENGTH } from "../profanity";

describe("profanity", () => {
  it("returns false for clean text", () => {
    expect(containsProfanity("do a muscle-up in 6 months")).toBe(false);
  });

  it("returns true for profane text", () => {
    expect(containsProfanity("shit")).toBe(true);
  });

  it("exports the max length constant", () => {
    expect(MAX_CUSTOM_GOAL_LENGTH).toBe(120);
  });
});
