import * as Application from "expo-application";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { posthog } from "./posthog";

export type OperationalArea = "app" | "feedback" | "generation" | "sync";
export type JourneyStage =
  | "activation"
  | "generation"
  | "in_session"
  | "post_workout"
  | "profile"
  | "startup";

export function getJourneyStageForPath(pathname: string): JourneyStage {
  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  if (
    pathname.startsWith("/(auth)") ||
    pathname.startsWith("/(onboarding)") ||
    [
      "equipment",
      "experience",
      "forgot-password",
      "frequency",
      "gender",
      "goal",
      "reset-password",
      "review",
      "sign-in",
      "sign-up",
      "strength",
    ].includes(firstSegment)
  ) {
    return "activation";
  }
  if (
    pathname.startsWith("/workout-summary") ||
    pathname.startsWith("/history") ||
    pathname.startsWith("/statistics")
  ) {
    return "post_workout";
  }
  if (
    pathname.startsWith("/workout") &&
    !pathname.startsWith("/workout-preview")
  ) {
    return "in_session";
  }
  if (
    pathname.startsWith("/generate-workout") ||
    pathname.startsWith("/workout-preview") ||
    pathname === "/" ||
    pathname.startsWith("/(tabs)")
  ) {
    return "generation";
  }
  if (
    pathname.startsWith("/feedback") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/training-preferences") ||
    pathname.startsWith("/strength-baselines")
  ) {
    return "profile";
  }
  return "startup";
}

export function setOperationalJourneyStage(stage: JourneyStage): void {
  if (posthog) {
    void posthog.register({ journey_stage: stage }).catch(() => {
      // Observability must never interrupt navigation.
    });
  }
}

interface OperationalContext {
  area: OperationalArea;
  operation: string;
  journeyStage: JourneyStage;
  failureCode?: string;
  generationSource?: "llm" | "fallback_template" | "fallback_substitution";
  latencyMs?: number;
  queueAgeMs?: number;
  retryCount?: number;
}

interface OperationalMetric extends OperationalContext {
  outcome: "fallback" | "recovered" | "resolved" | "success";
}

function baseProperties(context: OperationalContext) {
  return {
    area: context.area,
    operation: context.operation,
    journey_stage: context.journeyStage,
    app_version:
      Application.nativeApplicationVersion ??
      Constants.expoConfig?.version ??
      "unknown",
    platform: Platform.OS,
    failure_code: context.failureCode ?? null,
    generation_source: context.generationSource ?? null,
    latency_ms: context.latencyMs ?? null,
    queue_age_ms: context.queueAgeMs ?? null,
    retry_count: context.retryCount ?? null,
  };
}

/**
 * Reports a handled critical failure using an allowlisted context only.
 * The original error is intentionally not accepted because backend messages can
 * include request data. The stable fingerprint groups repeated failures.
 */
export function reportHandledOperationalError(
  context: OperationalContext
): void {
  const failureCode = context.failureCode ?? "unknown_failure";
  const properties = {
    ...baseProperties(context),
    outcome: "failure",
    severity: "critical",
    $exception_fingerprint: `${context.area}:${context.operation}:${failureCode}`,
  };

  if (__DEV__) {
    console.warn("[observability] handled failure", properties);
  }

  posthog?.captureException(new Error(failureCode), properties);
  posthog?.capture("operational_event", properties);
}

export function reportOperationalMetric(metric: OperationalMetric): void {
  const properties = {
    ...baseProperties(metric),
    outcome: metric.outcome,
    severity: "info",
  };

  if (__DEV__) {
    console.log("[observability] metric", properties);
  }

  posthog?.capture("operational_event", properties);
}
