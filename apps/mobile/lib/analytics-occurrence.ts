import { randomUUID } from "expo-crypto";

import type { EventName } from "./analytics-contract";

/**
 * Creates one stable identifier for a user action. Reuse the returned value
 * across retries/callbacks for that action; a fresh user action gets a new ID.
 */
export function createAnalyticsOccurrenceId(eventName: EventName): string {
  return `${eventName}:${randomUUID()}`;
}
