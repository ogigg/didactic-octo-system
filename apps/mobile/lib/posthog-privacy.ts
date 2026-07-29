interface PostHogEvent {
  event?: string;
  properties?: Record<string, unknown>;
}

const SENSITIVE_EXCEPTION_FIELDS = new Set([
  "$exception_message",
  "$exception_value",
  "message",
  "value",
]);

function redactExceptionValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactExceptionValue);
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      SENSITIVE_EXCEPTION_FIELDS.has(key.toLowerCase())
        ? "[redacted]"
        : redactExceptionValue(nestedValue),
    ])
  );
}

/**
 * Keeps stack frames and exception types for grouping while ensuring exception
 * messages cannot leak workout notes, prompts, email addresses, or other PII.
 */
export function sanitizePostHogEvent<T extends PostHogEvent>(
  event: T | null
): T | null {
  if (event?.event !== "$exception" || !event.properties) {
    return event;
  }

  const exceptionList = event.properties.$exception_list;
  if (exceptionList !== undefined) {
    event.properties.$exception_list = redactExceptionValue(exceptionList);
  }
  event.properties.crash_classification = "fatal_or_unhandled";
  event.properties.privacy_redacted = true;

  return event;
}
