import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { z } from "zod";

import { posthog } from "./posthog";
import { supabase } from "./supabase";

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
  correlationId?: string;
  dedupeKey?: string;
}

interface OperationalMetric extends OperationalContext {
  outcome: "fallback" | "recovered" | "resolved" | "success";
}

function baseProperties(context: OperationalContext) {
  const correlationId = context.correlationId ?? Crypto.randomUUID();
  return {
    $insert_id: context.dedupeKey ?? correlationId,
    area: context.area,
    operation: context.operation,
    journey_stage: context.journeyStage,
    app_version:
      Application.nativeApplicationVersion ??
      Constants.expoConfig?.version ??
      "unknown",
    platform: Platform.OS,
    authoritative_source: "mobile",
    correlation_id: correlationId,
    failure_code: context.failureCode ?? null,
    generation_source: context.generationSource ?? null,
    latency_ms: context.latencyMs ?? null,
    queue_age_ms: context.queueAgeMs ?? null,
    retry_count: context.retryCount ?? null,
  };
}

/**
 * Reports a handled critical failure using allowlisted context only. Handled
 * failures intentionally remain operational events and never become
 * `$exception`; crash alerts are reserved for fatal/unhandled SDK capture.
 */
export function reportHandledOperationalError(
  context: OperationalContext
): void {
  const failureCode = context.failureCode ?? "unknown_failure";
  const properties = {
    ...baseProperties(context),
    outcome: "failure",
    severity: "critical",
  };

  if (__DEV__) {
    console.warn("[observability] handled failure", properties);
  }

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

const identityResponseSchema = z.object({
  observability_id: z.string().regex(/^obs_[a-f0-9]{64}$/),
});

let currentObservabilityId: string | null = null;
let identityEpoch = 0;

export function getObservabilityHeaders(): Record<string, string> {
  return currentObservabilityId
    ? { "x-observability-id": currentObservabilityId }
    : {};
}

/**
 * Resolves the server-derived opaque identity for the currently authenticated
 * session. No Supabase UUID or profile property is sent to PostHog.
 */
export async function identifyObservabilityUser(): Promise<void> {
  const requestedEpoch = identityEpoch;
  const { data, error } = await supabase.functions.invoke(
    "observability-identity"
  );
  if (error) {
    throw new Error("Failed to resolve observability identity");
  }

  const parsed = identityResponseSchema.safeParse(data);
  if (!parsed.success || requestedEpoch !== identityEpoch) {
    return;
  }

  currentObservabilityId = parsed.data.observability_id;
  posthog?.identify(currentObservabilityId);
}

export function resetObservabilityIdentity(): void {
  identityEpoch += 1;
  currentObservabilityId = null;
  posthog?.reset();
}
