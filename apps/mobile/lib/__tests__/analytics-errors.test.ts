import { normalizeAnalyticsError } from "../analytics-errors";

describe("normalizeAnalyticsError", () => {
  it("maps network failures to a retryable offline category", () => {
    expect(
      normalizeAnalyticsError(new Error("Network request failed"))
    ).toEqual({
      error_code: "network",
      retryable: true,
      is_offline: true,
    });
  });

  it("maps generation limits without exposing provider details", () => {
    expect(
      normalizeAnalyticsError(new Error("generation_limit_reached"))
    ).toEqual({
      error_code: "rate_limited",
      retryable: false,
      is_offline: false,
    });
  });

  it("falls back to an allowlisted unknown category", () => {
    expect(normalizeAnalyticsError(new Error("provider secret"))).toEqual({
      error_code: "unknown",
      retryable: false,
      is_offline: false,
    });
  });
});
