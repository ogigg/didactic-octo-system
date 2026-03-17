// bad-words is CommonJS; Metro bundler handles this fine in RN
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Filter } = require("bad-words");
const filter = new Filter();

export const MAX_CUSTOM_GOAL_LENGTH = 120;

export function containsProfanity(text: string): boolean {
  try {
    return filter.isProfane(text);
  } catch {
    return false; // fail open — don't block the user on filter errors
  }
}
