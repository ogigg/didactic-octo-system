interface WorkoutDeletionLogContext {
  sessionId?: string;
  hasHealthRecord?: boolean;
  errorCode?: string;
  errorDetails?: string | null;
  errorHint?: string | null;
  healthResult?: string;
  workoutQueryCount?: number;
  calendarQueryCount?: number;
}

function sanitizedContext(
  context: WorkoutDeletionLogContext
): Record<string, unknown> {
  const { sessionId, ...details } = context;

  return {
    ...details,
    ...(sessionId ? { sessionRef: sessionId.slice(-8) } : {}),
  };
}

export function logWorkoutDeletionTrace(
  stage: string,
  context: WorkoutDeletionLogContext = {}
): void {
  if (!__DEV__) return;

  // eslint-disable-next-line no-console
  console.info(`[workout-delete] ${stage}`, sanitizedContext(context));
}

export function logWorkoutDeletionError(
  stage: string,
  error: unknown,
  context: WorkoutDeletionLogContext = {}
): void {
  const errorDescription =
    error instanceof Error
      ? { errorName: error.name, errorMessage: error.message }
      : { errorMessage: String(error) };

  console.error(`[workout-delete] ${stage}`, {
    ...sanitizedContext(context),
    ...errorDescription,
  });
}
