import { resources } from "../resources";

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap(collectStrings);
}

// Streak copy must stay supportive: no loss framing, urgency, or upsell pressure.
const pressurePatterns = [
  /\blost\b/i,
  /\blose\b/i,
  /\bbroke(n)?\b/i,
  /\bfail(ed|ure)?\b/i,
  /\bhurry\b/i,
  /\blast chance\b/i,
  /\bdon['’]t miss\b/i,
  /\bunlock\b/i,
  /\bupgrade now\b/i,
  /!/,
];

describe("streak protection copy", () => {
  it("avoids guilt, urgency, and pushy upgrade language in English", () => {
    const offenders = collectStrings(resources.en.streakProtection).filter(
      (text) => pressurePatterns.some((pattern) => pattern.test(text))
    );

    expect(offenders).toEqual([]);
  });

  it("explains the outcome of using or skipping a protection", () => {
    const { states } = resources.en.streakProtection;

    for (const state of [
      states.free_earned_freeze,
      states.free_lifetime_rescue,
      states.pro_available_freeze,
    ]) {
      expect(state.body).toMatch(/keep your streak/);
      expect(state.body).toMatch(/start a new streak with your next workout/);
    }

    expect(states.free_comeback.body).toMatch(/past workouts are all saved/);
    expect(states.pro_comeback.body).toMatch(/past workouts are all saved/);
  });

  it("keeps the restart confirmation honest about workout history", () => {
    expect(resources.en.streakProtection.restartConfirm.body).toMatch(
      /logged stays/
    );
    expect(resources.pl.streakProtection.restartConfirm.body).toMatch(
      /co zapisałeś, zostaje/
    );
  });

  it("keeps titles and buttons short enough for one line at large text sizes", () => {
    const { states, actions } = resources.en.streakProtection;

    for (const state of Object.values(states)) {
      expect(state.title.length).toBeLessThanOrEqual(36);
    }
    for (const label of Object.values(actions)) {
      expect(label.length).toBeLessThanOrEqual(20);
    }
  });
});
