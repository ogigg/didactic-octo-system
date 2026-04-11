/**
 * Neutral payload shape passed across the Platform.select facade.
 * Supabase DB remains the source of truth for set-level data; Health
 * platforms only receive a session-level envelope.
 */
export interface HealthWorkoutPayload {
  startedAt: Date;
  endedAt: Date;
  /** `cardio` is reserved for a future phase — currently unmapped. */
  type: "strength" | "cardio";
}

export type HealthPermissionStatus =
  | "granted"
  | "denied"
  | "skipped"
  | "unavailable"
  | "unknown";

export type HealthWriteResult =
  | { ok: true; externalId: string }
  | {
      ok: false;
      reason: "no-permission" | "unavailable" | "error";
      error?: unknown;
    };
