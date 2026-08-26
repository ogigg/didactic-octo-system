import {
  analyticsEnvironment,
  getSharedAnalyticsProperties,
  posthog,
  safelyCallPostHog,
  type AnalyticsEnvironment,
} from "./posthog";

export type Primitive = string | number | boolean | null;
export type EventValue = Primitive | Primitive[];

export type AuthMethod = "email" | "apple" | "google";

export const DIFFICULTY_FEEDBACK_VALUES = [
  "too_easy",
  "ok",
  "too_hard",
] as const;

export type DifficultyFeedbackValue =
  (typeof DIFFICULTY_FEEDBACK_VALUES)[number];

/**
 * The event contract is intentionally kept in one map. Add a name and its
 * properties here before emitting a new event so the call site gets compile-
 * time checking and the runtime allowlist below can reject accidental data.
 *
 * Properties are optional while the legacy instrumentation is migrated to the
 * launch contract. New P0 callers should provide the required fields described
 * in ANALYTICS.md.
 */
export interface EventPayloadMap {
  // Authentication and identity
  signup_started: { auth_method?: AuthMethod };
  user_signed_up: {
    auth_method?: AuthMethod;
    is_email_confirmation_required?: boolean;
  };
  signup_failed: {
    auth_method?: AuthMethod;
    error_code?: string;
    failure_stage?: string;
  };
  signin_started: { auth_method?: AuthMethod };
  user_signed_in: { auth_method?: AuthMethod };
  signin_failed: {
    auth_method?: AuthMethod;
    error_code?: string;
    failure_stage?: string;
  };
  user_signed_out: Record<string, never>;
  // Friendly aliases used by a few integrations. Prefer the canonical names
  // above for new code.
  auth_started: { auth_method?: AuthMethod; flow?: string };
  auth_succeeded: { auth_method?: AuthMethod; flow?: string };
  auth_failed: {
    auth_method?: AuthMethod;
    flow?: string;
    error_code?: string;
    failure_stage?: string;
  };

  // Onboarding
  onboarding_started: { entry_point?: string };
  onboarding_step_viewed: {
    step?: string;
    step_index?: number;
    edit_mode?: boolean;
  };
  onboarding_step_completed: {
    step?: string;
    step_index?: number;
    edit_mode?: boolean;
    skipped?: boolean;
  };
  onboarding_save_failed: { error_code?: string; step?: string };
  onboarding_completed: {
    duration_seconds?: number;
    goal_category?: string;
    weekly_frequency?: number | string;
    equipment?: string;
    experience?: string;
    baseline_count?: number;
  };
  strength_baseline_entered: {
    exercise_key?: string;
    has_load?: boolean;
    source?: string;
  };

  // Generation and queue readiness
  /** Client intent; the Supabase function owns canonical started/completed/failed events. */
  workout_generation_requested: {
    request_id?: string;
    trigger?: string;
  };
  /** Failures before the generation function is invoked. */
  workout_generation_client_failed: {
    request_id?: string;
    workout_id?: string;
    queue_position?: number;
    error_code?: string;
    failure_stage?: string;
    retryable?: boolean;
    is_offline?: boolean;
  };
  /** Failures before the queue generation function is invoked. */
  workout_queue_client_failed: {
    request_id?: string;
    count?: number;
    trigger?: string;
    error_code?: string;
    failure_stage?: string;
    retryable?: boolean;
    is_offline?: boolean;
  };
  workout_queue_initialized: {
    request_id?: string;
    count?: number;
    trigger?: string;
  };
  pending_workout_generated: {
    request_id?: string;
    workout_id?: string;
    generation_source?: string;
    trigger?: string;
    generation_time_ms?: number | null;
    queue_position?: number;
    focus_area?: string;
  };
  workout_generation_started: {
    request_id?: string;
    workout_id?: string;
    queue_position?: number;
    generation_source?: string;
    trigger?: string;
  };
  workout_generation_completed: {
    request_id?: string;
    workout_id?: string;
    generation_source?: string;
    generation_time_ms?: number;
    queue_position?: number;
    exercise_count?: number;
    trigger?: string;
  };
  workout_generation_failed: {
    request_id?: string;
    workout_id?: string;
    queue_position?: number;
    generation_time_ms?: number;
    trigger?: string;
    error_code?: string;
    failure_stage?: string;
    retryable?: boolean;
  };
  workout_queue_ready: {
    request_id?: string;
    trigger?: string;
    total_generation_time_ms?: number | null;
    count?: number;
    fallback_count?: number;
  };
  workout_queue_failed: {
    request_id?: string;
    trigger?: string;
    count?: number;
    ready_count?: number;
    failed_count?: number;
    error_code?: string;
  };
  // Alternative names retained for server-side generation integrations.
  queue_generation_started: {
    request_id?: string;
    count?: number;
    trigger?: string;
  };
  queue_generation_completed: {
    request_id?: string;
    count?: number;
    fallback_count?: number;
    total_generation_time_ms?: number;
  };
  queue_generation_failed: {
    request_id?: string;
    ready_count?: number;
    failed_count?: number;
    error_code?: string;
  };
  generation_started: {
    request_id?: string;
    generation_source?: string;
    trigger?: string;
  };
  generation_completed: {
    request_id?: string;
    generation_source?: string;
    generation_time_ms?: number;
    exercise_count?: number;
  };
  generation_failed: {
    request_id?: string;
    error_code?: string;
    failure_stage?: string;
    retryable?: boolean;
  };
  pending_workout_started: {
    workout_id?: string;
    time_since_generated_ms?: number | null;
    was_edited?: boolean;
    edit_count?: number;
  };
  pending_workout_regenerated: {
    request_id?: string;
    workout_id?: string;
    phase?: string;
    queue_position?: number;
    focus_area?: string;
    previous_generation_source?: string;
    has_feedback?: boolean;
    feedback_length?: number;
    error_code?: string;
  };
  pending_workout_edited: {
    workout_id?: string;
    edit_type?: string;
  };
  workout_preview_viewed: {
    workout_id?: string;
    queue_position?: number;
    generation_source?: string;
    time_on_screen_ms?: number;
  };
  workout_generated: {
    request_id?: string;
    generation_source?: string;
    training_split?: string;
    duration_minutes?: number;
    equipment?: string;
    training_style?: string;
    difficulty?: string;
    exercise_count?: number;
    has_custom_prompt?: boolean;
    generation_time_ms?: number;
  };

  // Unified workout execution and persistence
  workout_started: {
    workout_session_id?: string;
    workout_source?: string;
    source?: string;
    workout_id?: string;
    generation_source?: string | null;
    exercise_count?: number;
    planned_set_count?: number;
    planned_sets?: number;
    has_warmup?: boolean;
    was_edited?: boolean;
    edit_count?: number;
  };
  workout_first_set_logged: {
    workout_session_id?: string;
    seconds_since_start?: number;
  };
  workout_progress_reached: {
    workout_session_id?: string;
    progress_percent?: number;
    seconds_since_start?: number;
  };
  workout_finish_requested: {
    workout_session_id?: string;
    completion_rate?: number;
    completed_sets?: number;
    planned_sets?: number;
    duration_seconds?: number;
  };
  workout_completed: {
    workout_session_id?: string;
    workout_source?: string;
    generation_source?: string | null;
    workout_id?: string | null;
    workout_name?: string;
    exercise_count?: number;
    total_sets?: number;
    completed_sets?: number;
    completion_rate?: number;
    total_volume_kg?: number;
    duration_seconds?: number;
    is_partial?: boolean;
    goal_snapshot?: string;
    custom_goal_snapshot?: string | null;
  };
  workout_save_failed: {
    workout_session_id?: string;
    error_code?: string;
    retryable?: boolean;
    is_offline?: boolean;
  };
  workout_discarded: {
    workout_session_id?: string;
    completed_sets?: number;
    planned_sets?: number;
    completion_rate?: number;
    duration_seconds?: number;
    discard_context?: string;
  };
  workout_abandoned: {
    workout_session_id?: string;
    completed_sets?: number;
    completion_rate?: number;
    duration_seconds?: number;
    elapsed_seconds?: number;
    stale_after_hours?: number;
  };
  // Short aliases for consumers that use the event name without the domain
  // prefix. They are accepted but not used by the app's current call sites.
  first_set_logged: EventPayloadMap["workout_first_set_logged"];
  progress_reached: EventPayloadMap["workout_progress_reached"];
  finish_requested: EventPayloadMap["workout_finish_requested"];
  save_failed: EventPayloadMap["workout_save_failed"];
  discarded: EventPayloadMap["workout_discarded"];
  abandoned: EventPayloadMap["workout_abandoned"];
  session_duration: {
    workout_name?: string;
    duration_seconds?: number;
    exercise_count?: number;
    completion_rate?: number;
  };

  // Feedback and sharing
  feedback_given: {
    exercise_id?: string;
    difficulty?: DifficultyFeedbackValue;
    session_id?: string;
    workout_session_id?: string;
  };
  difficulty_feedback_given: {
    exercise_id?: string;
    exercise_name?: string;
    difficulty?: DifficultyFeedbackValue;
    feedback?: DifficultyFeedbackValue;
    session_id?: string;
    workout_session_id?: string;
  };
  workout_comment_submitted: {
    session_id?: string;
    workout_session_id?: string;
    length?: number;
    length_bucket?: string;
    chip_count?: number;
    has_freeform?: boolean;
  };
  product_feedback_submitted: {
    feedback_type?: string;
    has_title?: boolean;
    description_length_bucket?: string;
  };
  product_feedback_failed: { feedback_type?: string; error_code?: string };
  workout_summary_share_requested: SharePayload;
  workout_summary_share_unavailable: SharePayload;
  workout_summary_share_completed: SharePayload;
  workout_summary_share_failed: SharePayload & {
    error?: string;
    error_code?: string;
  };

  // Monetization and preferences
  paywall_viewed: {
    source?: string;
    used_count?: number;
    limit_count?: number;
  };
  paywall_dismissed: {
    source?: string;
    used_count?: number;
    limit_count?: number;
  };
  upgrade_tapped: {
    source?: string;
    used_count?: number;
    limit_count?: number;
  };
  streak_upgrade_tapped: StreakPayload;
  training_preferences_changed: {
    changed_fields?: string[];
    triggered_queue_rebuild?: boolean;
  };
  queue_state_on_open: {
    ready_count?: number;
    generating_count?: number;
    failed_count?: number;
    total_count?: number;
    has_active_workout?: boolean;
  };

  // Streak protection
  streak_status_viewed: StreakPayload;
  streak_prompt_shown: StreakPayload;
  streak_prompt_dismissed: StreakPayload;
  streak_protection_applied: StreakPayload & { protection_type?: string };
  streak_lifetime_rescue_used: StreakPayload;
  streak_freeze_earned: StreakPayload;
  streak_restarted: StreakPayload;
  comeback_workout_started: StreakPayload & { had_ready_workout?: boolean };
  comeback_workout_completed: StreakPayload & {
    had_ready_workout?: boolean;
    time_since_comeback_started_ms?: number;
    duration_seconds?: number;
  };
}

export interface SharePayload {
  exercise_count?: number;
  completed_sets?: number;
  total_sets?: number;
  completion_rate?: number;
  total_volume_kg?: number;
  duration_seconds?: number;
  highlight_count?: number;
}

export interface StreakPayload {
  tier?: string;
  is_pro_active?: boolean;
  streak_weeks?: number;
  missed_weeks?: number;
  days_since_last_workout?: number | null;
  prompt_state?: string;
  pro_freezes_available?: number;
  earned_freezes_available?: number;
  lifetime_rescue_available?: boolean;
  auto_apply_enabled?: boolean;
}

export type EventName = keyof EventPayloadMap;
/** Compatibility shape for existing helpers that build a payload once and
 * reuse it across several related events. New call sites should rely on the
 * event-specific `EventPayloadMap[Name]` inferred by `trackEvent`. */
export type EventPayload = Record<string, EventValue>;

const SHARE_KEYS = new Set([
  "exercise_count",
  "completed_sets",
  "total_sets",
  "completion_rate",
  "total_volume_kg",
  "duration_seconds",
  "highlight_count",
]);

const STREAK_KEYS = new Set([
  "tier",
  "is_pro_active",
  "streak_weeks",
  "missed_weeks",
  "days_since_last_workout",
  "prompt_state",
  "pro_freezes_available",
  "earned_freezes_available",
  "lifetime_rescue_available",
  "auto_apply_enabled",
]);

const ALLOWED_PROPERTY_KEYS: Record<EventName, ReadonlySet<string>> = {
  signup_started: new Set(["auth_method"]),
  user_signed_up: new Set(["auth_method", "is_email_confirmation_required"]),
  signup_failed: new Set(["auth_method", "error_code", "failure_stage"]),
  signin_started: new Set(["auth_method"]),
  user_signed_in: new Set(["auth_method"]),
  signin_failed: new Set(["auth_method", "error_code", "failure_stage"]),
  user_signed_out: new Set(),
  auth_started: new Set(["auth_method", "flow"]),
  auth_succeeded: new Set(["auth_method", "flow"]),
  auth_failed: new Set(["auth_method", "flow", "error_code", "failure_stage"]),
  onboarding_started: new Set(["entry_point"]),
  onboarding_step_viewed: new Set(["step", "step_index", "edit_mode"]),
  onboarding_step_completed: new Set([
    "step",
    "step_index",
    "edit_mode",
    "skipped",
  ]),
  onboarding_save_failed: new Set(["error_code", "step"]),
  onboarding_completed: new Set([
    "duration_seconds",
    "goal_category",
    "weekly_frequency",
    "equipment",
    "experience",
    "baseline_count",
  ]),
  strength_baseline_entered: new Set(["exercise_key", "has_load", "source"]),
  workout_generation_requested: new Set(["request_id", "trigger"]),
  workout_generation_client_failed: new Set([
    "request_id",
    "workout_id",
    "queue_position",
    "error_code",
    "failure_stage",
    "retryable",
    "is_offline",
  ]),
  workout_queue_client_failed: new Set([
    "request_id",
    "count",
    "trigger",
    "error_code",
    "failure_stage",
    "retryable",
    "is_offline",
  ]),
  workout_queue_initialized: new Set(["request_id", "count", "trigger"]),
  pending_workout_generated: new Set([
    "request_id",
    "workout_id",
    "generation_source",
    "trigger",
    "generation_time_ms",
    "queue_position",
    "focus_area",
  ]),
  workout_generation_started: new Set([
    "request_id",
    "workout_id",
    "queue_position",
    "generation_source",
    "trigger",
  ]),
  workout_generation_completed: new Set([
    "request_id",
    "workout_id",
    "generation_source",
    "generation_time_ms",
    "queue_position",
    "exercise_count",
    "trigger",
  ]),
  workout_generation_failed: new Set([
    "request_id",
    "workout_id",
    "queue_position",
    "generation_time_ms",
    "trigger",
    "error_code",
    "failure_stage",
    "retryable",
  ]),
  workout_queue_ready: new Set([
    "request_id",
    "trigger",
    "total_generation_time_ms",
    "count",
    "fallback_count",
  ]),
  workout_queue_failed: new Set([
    "request_id",
    "trigger",
    "count",
    "ready_count",
    "failed_count",
    "error_code",
  ]),
  queue_generation_started: new Set(["request_id", "count", "trigger"]),
  queue_generation_completed: new Set([
    "request_id",
    "count",
    "fallback_count",
    "total_generation_time_ms",
  ]),
  queue_generation_failed: new Set([
    "request_id",
    "ready_count",
    "failed_count",
    "error_code",
  ]),
  generation_started: new Set(["request_id", "generation_source", "trigger"]),
  generation_completed: new Set([
    "request_id",
    "generation_source",
    "generation_time_ms",
    "exercise_count",
  ]),
  generation_failed: new Set([
    "request_id",
    "error_code",
    "failure_stage",
    "retryable",
  ]),
  pending_workout_started: new Set([
    "workout_id",
    "time_since_generated_ms",
    "was_edited",
    "edit_count",
  ]),
  pending_workout_regenerated: new Set([
    "request_id",
    "workout_id",
    "phase",
    "queue_position",
    "focus_area",
    "previous_generation_source",
    "has_feedback",
    "feedback_length",
    "error_code",
  ]),
  pending_workout_edited: new Set(["workout_id", "edit_type"]),
  workout_preview_viewed: new Set([
    "workout_id",
    "queue_position",
    "generation_source",
    "time_on_screen_ms",
  ]),
  workout_generated: new Set([
    "request_id",
    "generation_source",
    "training_split",
    "duration_minutes",
    "equipment",
    "training_style",
    "difficulty",
    "exercise_count",
    "has_custom_prompt",
    "generation_time_ms",
  ]),
  workout_started: new Set([
    "workout_session_id",
    "workout_source",
    "source",
    "workout_id",
    "generation_source",
    "exercise_count",
    "planned_set_count",
    "planned_sets",
    "has_warmup",
    "was_edited",
    "edit_count",
  ]),
  workout_first_set_logged: new Set([
    "workout_session_id",
    "seconds_since_start",
  ]),
  workout_progress_reached: new Set([
    "workout_session_id",
    "progress_percent",
    "seconds_since_start",
  ]),
  workout_finish_requested: new Set([
    "workout_session_id",
    "completion_rate",
    "completed_sets",
    "planned_sets",
    "duration_seconds",
  ]),
  workout_completed: new Set([
    "workout_session_id",
    "workout_source",
    "generation_source",
    "workout_id",
    // Legacy keys remain in the type for migration, but are rejected at runtime.
    "workout_name",
    "exercise_count",
    "total_sets",
    "completed_sets",
    "completion_rate",
    "total_volume_kg",
    "duration_seconds",
    "is_partial",
    "goal_snapshot",
    "custom_goal_snapshot",
  ]),
  workout_save_failed: new Set([
    "workout_session_id",
    "error_code",
    "retryable",
    "is_offline",
  ]),
  workout_discarded: new Set([
    "workout_session_id",
    "completed_sets",
    "planned_sets",
    "completion_rate",
    "duration_seconds",
    "discard_context",
  ]),
  workout_abandoned: new Set([
    "workout_session_id",
    "completed_sets",
    "completion_rate",
    "duration_seconds",
    "elapsed_seconds",
    "stale_after_hours",
  ]),
  first_set_logged: new Set(["workout_session_id", "seconds_since_start"]),
  progress_reached: new Set([
    "workout_session_id",
    "progress_percent",
    "seconds_since_start",
  ]),
  finish_requested: new Set([
    "workout_session_id",
    "completion_rate",
    "completed_sets",
    "planned_sets",
    "duration_seconds",
  ]),
  save_failed: new Set([
    "workout_session_id",
    "error_code",
    "retryable",
    "is_offline",
  ]),
  discarded: new Set([
    "workout_session_id",
    "completed_sets",
    "planned_sets",
    "completion_rate",
    "duration_seconds",
    "discard_context",
  ]),
  abandoned: new Set([
    "workout_session_id",
    "completed_sets",
    "completion_rate",
    "duration_seconds",
    "elapsed_seconds",
    "stale_after_hours",
  ]),
  session_duration: new Set([
    "workout_name",
    "duration_seconds",
    "exercise_count",
    "completion_rate",
  ]),
  feedback_given: new Set([
    "exercise_id",
    "difficulty",
    "session_id",
    "workout_session_id",
  ]),
  difficulty_feedback_given: new Set([
    "exercise_id",
    "exercise_name",
    "difficulty",
    "feedback",
    "session_id",
    "workout_session_id",
  ]),
  workout_comment_submitted: new Set([
    "session_id",
    "workout_session_id",
    "length",
    "length_bucket",
    "chip_count",
    "has_freeform",
  ]),
  product_feedback_submitted: new Set([
    "feedback_type",
    "has_title",
    "description_length_bucket",
  ]),
  product_feedback_failed: new Set(["feedback_type", "error_code"]),
  workout_summary_share_requested: SHARE_KEYS,
  workout_summary_share_unavailable: SHARE_KEYS,
  workout_summary_share_completed: SHARE_KEYS,
  workout_summary_share_failed: new Set([...SHARE_KEYS, "error", "error_code"]),
  paywall_viewed: new Set(["source", "used_count", "limit_count"]),
  paywall_dismissed: new Set(["source", "used_count", "limit_count"]),
  upgrade_tapped: new Set(["source", "used_count", "limit_count"]),
  streak_upgrade_tapped: STREAK_KEYS,
  training_preferences_changed: new Set([
    "changed_fields",
    "triggered_queue_rebuild",
  ]),
  queue_state_on_open: new Set([
    "ready_count",
    "generating_count",
    "failed_count",
    "total_count",
    "has_active_workout",
  ]),
  streak_status_viewed: STREAK_KEYS,
  streak_prompt_shown: STREAK_KEYS,
  streak_prompt_dismissed: STREAK_KEYS,
  streak_protection_applied: new Set([...STREAK_KEYS, "protection_type"]),
  streak_lifetime_rescue_used: STREAK_KEYS,
  streak_freeze_earned: STREAK_KEYS,
  streak_restarted: STREAK_KEYS,
  comeback_workout_started: new Set([...STREAK_KEYS, "had_ready_workout"]),
  comeback_workout_completed: new Set([
    ...STREAK_KEYS,
    "had_ready_workout",
    "time_since_comeback_started_ms",
    "duration_seconds",
  ]),
};

// A second defence protects against a property being accidentally added to an
// allowlist before its privacy implications have been reviewed.
const SENSITIVE_PROPERTY_PATTERN =
  /(^|_)(password|passcode|token|secret|authorization|cookie|email|phone|phone_number|address|name|comment|description|free_text|custom_goal|measurement|height|weight|health|raw_error|stack|message)(_|$)/i;

function isSensitiveProperty(key: string): boolean {
  if (
    key === "is_email_confirmation_required" ||
    key === "description_length_bucket"
  ) {
    return false;
  }

  return (
    key === "error" ||
    key === "workout_name" ||
    key === "exercise_name" ||
    key === "custom_goal_snapshot" ||
    SENSITIVE_PROPERTY_PATTERN.test(key)
  );
}

function isAllowedEnumValue(
  name: EventName,
  key: string,
  value: unknown
): boolean {
  const isDifficultyField =
    (name === "feedback_given" && key === "difficulty") ||
    (name === "difficulty_feedback_given" &&
      (key === "difficulty" || key === "feedback"));

  if (!isDifficultyField) return true;

  return (
    typeof value === "string" &&
    (DIFFICULTY_FEEDBACK_VALUES as readonly string[]).includes(value)
  );
}

function sanitizeValue(value: unknown): Primitive | Primitive[] | undefined {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number")
    return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    // String-valued properties are enums, IDs, or normalized error codes. A
    // length cap prevents an accidental free-form value from becoming a large
    // event even if a new key slips through the allowlist.
    return value.length <= 120 ? value : value.slice(0, 120);
  }
  if (Array.isArray(value)) {
    const sanitized = value
      .map((item) => sanitizeValue(item))
      .filter(
        (item): item is Primitive => item !== undefined && !Array.isArray(item)
      );
    return sanitized;
  }
  return undefined;
}

/** Exported for focused unit tests and for boundary tests in future work. */
export function sanitizeEventPayload(
  name: EventName,
  payload: object
): Record<string, EventValue> {
  const allowed = ALLOWED_PROPERTY_KEYS[name];
  const safePayload: Record<string, EventValue> = {};

  for (const [key, value] of Object.entries(
    payload as Record<string, unknown>
  )) {
    if (
      !allowed.has(key) ||
      isSensitiveProperty(key) ||
      !isAllowedEnumValue(name, key, value)
    )
      continue;
    const safeValue = sanitizeValue(value);
    if (safeValue !== undefined) {
      safePayload[key] = safeValue;
    }
  }

  return safePayload;
}

function sanitizePersonProperties(
  properties: Record<string, unknown>
): Record<string, EventValue> {
  const allowed = new Set([
    "onboarding_completed",
    "goal_category",
    "weekly_frequency",
    "equipment",
    "experience",
    "subscription_tier",
    "language",
    "first_app_version",
    // Legacy aliases are accepted for callers that have not migrated yet.
    "goal",
    "frequency",
  ]);
  const safe: Record<string, EventValue> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (!allowed.has(key) || isSensitiveProperty(key)) continue;
    const safeValue = sanitizeValue(value);
    if (safeValue !== undefined) safe[key] = safeValue;
  }

  return safe;
}

let identifiedUserId: string | null = null;
let pendingPersonProperties: Record<string, EventValue> = {};
let lastScreenName: string | null = null;

/** Normalize SDK/provider errors to a low-cardinality category. */
export function normalizeAuthError(error: unknown): string {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code.toLowerCase()
      : "";
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";

  if (code.includes("cancel") || code.includes("dismiss"))
    return "provider_cancelled";
  if (message.includes("invalid") || message.includes("credential"))
    return "invalid_credentials";
  if (message.includes("network") || message.includes("fetch"))
    return "network";
  if (message.includes("rate") || message.includes("too many"))
    return "rate_limited";
  if (code.includes("timeout") || message.includes("timeout")) return "timeout";
  return "unknown";
}

/** Identify a Supabase user with the stable UUID, never their email address. */
export function identifyUser(
  userId: string,
  properties: Record<string, unknown> = {}
): void {
  const normalizedId = userId.trim();
  if (!normalizedId) return;

  const safeProperties = {
    ...pendingPersonProperties,
    ...sanitizePersonProperties(properties),
  };
  pendingPersonProperties = {};

  const isSameUser = identifiedUserId === normalizedId;
  if (isSameUser) {
    // Repeated Supabase auth callbacks are common during token refresh. Do
    // not call identify again for the same UUID; applying new low-cardinality
    // properties is sufficient and avoids duplicate identity transitions.
    const client = posthog;
    if (client && Object.keys(safeProperties).length > 0) {
      safelyCallPostHog(() => client.setPersonProperties(safeProperties));
    }
    return;
  }

  // A new account on this device must never inherit the previous account's
  // queued events or person. Flush first, then reset, before identifying the
  // new UUID. The initial anonymous -> identified transition intentionally
  // keeps PostHog's normal anonymous attribution behavior.
  const client = posthog;
  if (identifiedUserId !== null && client) {
    safelyCallPostHog(() => client.flush());
    safelyCallPostHog(() => client.reset());
  }

  identifiedUserId = normalizedId;

  if (!client) return;

  safelyCallPostHog(() => client.identify(normalizedId, safeProperties));
  if (Object.keys(safeProperties).length > 0) {
    safelyCallPostHog(() => client.setPersonProperties(safeProperties));
  }
}

export function getIdentifiedUserId(): string | null {
  return identifiedUserId;
}

/**
 * Queue low-cardinality person properties until a Supabase identity exists.
 * Calling identify(undefined, ...) would create an invalid PostHog identity,
 * so this intentionally never does that.
 */
export function setUserProperties(properties: Record<string, unknown>): void {
  const safeProperties = sanitizePersonProperties(properties);
  pendingPersonProperties = { ...pendingPersonProperties, ...safeProperties };

  const client = posthog;
  if (!client || !identifiedUserId || Object.keys(safeProperties).length === 0)
    return;

  safelyCallPostHog(() => client.setPersonProperties(safeProperties));
}

export function resetUser(): void {
  identifiedUserId = null;
  pendingPersonProperties = {};
  // Screen de-duplication is scoped to an identified session. A second
  // account viewing the same route must still produce its own first screen
  // event after logout/account switching.
  lastScreenName = null;

  const client = posthog;
  if (!client) return;

  safelyCallPostHog(() => client.reset());
}

/**
 * Capture a typed, privacy-filtered event. The wrapper is intentionally the
 * only place application code should call PostHog capture.
 */
export function trackEvent<Name extends EventName>(
  name: Name,
  payload: EventPayloadMap[Name] | EventPayload = {} as EventPayloadMap[Name]
): void {
  const safePayload = sanitizeEventPayload(name, payload);
  const eventPayload = {
    ...getSharedAnalyticsProperties(),
    ...safePayload,
  };

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[analytics]", name, eventPayload);
  }

  const client = posthog;
  if (!client) return;

  safelyCallPostHog(() => client.capture(name, eventPayload));
}

const SCREEN_NAMES: Readonly<Record<string, string>> = {
  "sign-in": "sign_in",
  "sign-up": "sign_up",
  "forgot-password": "forgot_password",
  "reset-password": "reset_password",
  calendar: "calendar",
  history: "history",
  statistics: "statistics",
  profile: "profile",
  "training-preferences": "training_preferences",
  subscription: "subscription",
  feedback: "feedback",
  workout: "workout",
  "workout-preview": "workout_preview",
  "workout-summary": "workout_summary",
  "workout-detail": "workout_detail",
  "exercise-detail": "exercise_detail",
  "exercise-picker": "exercise_picker",
  "generate-workout": "generate_workout",
  measurements: "measurements",
  "strength-baselines": "strength_baselines",
  "health-settings": "health_settings",
  "delete-account": "delete_account",
  modal: "modal",
};

const ONBOARDING_STEPS: ReadonlySet<string> = new Set([
  "gender",
  "goal",
  "frequency",
  "equipment",
  "experience",
  "strength",
  "review",
]);

function normalizePathname(pathname: string): string {
  // Expo Router paths can contain route groups. Drop groups and any query/hash
  // before matching so IDs and reset tokens never reach PostHog.
  return pathname
    .split(/[?#]/, 1)[0]
    .split("/")
    .filter(Boolean)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")))
    .join("/");
}

/** Convert an Expo Router path to one of the reviewed, stable screen names. */
export function screenNameFromPath(pathname: string): string | null {
  const pathWithoutQuery = pathname.split(/[?#]/, 1)[0];
  const hasOnboardingGroup = /(?:^|\/)\(onboarding\)(?:\/|$)/.test(
    pathWithoutQuery
  );
  const normalized = normalizePathname(pathname);
  if (!normalized || normalized === "index" || normalized === "tabs/index")
    return "home";

  const parts = normalized.split("/");
  if (
    parts[0] === "onboarding" &&
    parts.length === 2 &&
    ONBOARDING_STEPS.has(parts[1])
  ) {
    const step = parts[1];
    return `onboarding_${step}`;
  }
  if (
    hasOnboardingGroup &&
    parts.length === 1 &&
    ONBOARDING_STEPS.has(parts[0])
  ) {
    const step = parts[0];
    return `onboarding_${step}`;
  }

  const direct = SCREEN_NAMES[parts[0]];
  return direct ?? null;
}

/** Capture a manually reviewed screen view for Expo Router/React Navigation 7. */
export function trackScreenView(pathname: string): void {
  const screenName = screenNameFromPath(pathname);
  if (!screenName || screenName === lastScreenName) return;
  lastScreenName = screenName;

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.log("[analytics] screen", screenName);
  }

  const client = posthog;
  if (!client) return;

  safelyCallPostHog(() =>
    client.screen(screenName, {
      ...getSharedAnalyticsProperties(),
      screen_name: screenName,
      environment: analyticsEnvironment as AnalyticsEnvironment,
    })
  );
}

/** Reset the de-duplication guard in deterministic tests. */
export function resetScreenTrackingState(): void {
  lastScreenName = null;
}
