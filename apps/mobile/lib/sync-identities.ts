interface MeasurementSyncIdentityInput {
  loggedAt: string;
  originalLoggedAt?: string;
}

export function createMeasurementSyncIdentity(
  userId: string,
  input: MeasurementSyncIdentityInput
): string {
  return `${userId}:measurement:${input.originalLoggedAt ?? input.loggedAt}`;
}
