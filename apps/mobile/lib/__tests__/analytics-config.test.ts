import { getAnalyticsConfigHealth } from "../analytics-config";

describe("analytics configuration health", () => {
  it("reports healthy configuration without exposing the key", () => {
    const secretKey = `phc_${"a".repeat(32)}`;
    const health = getAnalyticsConfigHealth({
      key: secretKey,
      host: "https://eu.posthog.com/capture",
    });

    expect(health).toEqual({
      keyConfigured: true,
      hostOrigin: "https://eu.posthog.com",
      status: "healthy",
    });
    expect(JSON.stringify(health)).not.toContain(secretKey);
  });

  it.each([
    [{ host: "https://app.posthog.com" }, "missing_key"],
    [{ key: "configured", host: "http://app.posthog.com" }, "invalid_host"],
    [{ key: "configured", host: "not-a-url" }, "invalid_host"],
    [
      { key: `phc_${"a".repeat(32)}`, host: "https://example.com" },
      "invalid_host",
    ],
    [
      { key: "ci-production-placeholder", host: "https://app.posthog.com" },
      "invalid_key",
    ],
  ] as const)("reports unhealthy configuration", (config, expectedStatus) => {
    expect(getAnalyticsConfigHealth(config).status).toBe(expectedStatus);
  });
});
