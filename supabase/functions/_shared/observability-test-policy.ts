interface ObservabilityTestEnvironment {
  appEnvironment?: string;
  enabled?: string;
  serviceRoleKey?: string;
  posthogProjectKey?: string;
  posthogHost?: string;
  identitySecret?: string;
}

export interface ObservabilityTestPolicy {
  available: boolean;
  configured: boolean;
}

export function getObservabilityTestPolicy(
  environment: ObservabilityTestEnvironment
): ObservabilityTestPolicy {
  const available =
    environment.appEnvironment !== "production" &&
    ["development", "preview", "staging"].includes(
      environment.appEnvironment ?? ""
    ) &&
    environment.enabled === "true";

  return {
    available,
    configured:
      available &&
      Boolean(
        environment.serviceRoleKey &&
          environment.posthogProjectKey &&
          environment.posthogHost &&
          environment.identitySecret
      ),
  };
}
