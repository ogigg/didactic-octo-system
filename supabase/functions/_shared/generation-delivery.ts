import { reportOperationalEvent } from "./observability.ts";

export interface GenerationDelivery {
  userId: string;
  operation: string;
  signalKey: string;
  durationMs: number;
  generationSource?: "llm" | "fallback_template" | "fallback_substitution";
  fallbackReason?: string;
}

interface PersistenceResult {
  error: unknown;
}

export function reportGenerationFailure(
  delivery: GenerationDelivery,
  failureCode: string
): void {
  reportOperationalEvent({
    area: "generation",
    operation: delivery.operation,
    outcome: "failure",
    journeyStage: "generation",
    userId: delivery.userId,
    durationMs: delivery.durationMs,
    failureCode,
    generationSource: delivery.generationSource,
    fallbackReason: delivery.fallbackReason,
    signalKey: `${delivery.signalKey}:failure:${failureCode}`,
  });
}

export function reportGenerationDelivered(delivery: GenerationDelivery): void {
  reportOperationalEvent({
    area: "generation",
    operation: delivery.operation,
    outcome: delivery.generationSource === "llm" ? "success" : "fallback",
    journeyStage: "generation",
    userId: delivery.userId,
    durationMs: delivery.durationMs,
    generationSource: delivery.generationSource,
    fallbackReason: delivery.fallbackReason,
    signalKey: `${delivery.signalKey}:delivered`,
  });
}

/**
 * Emits a delivered signal only after the caller's authoritative persistence
 * succeeds. The callback shape mirrors Supabase update results and is easy to
 * exercise without a database.
 */
export async function persistAndReportGeneration(
  delivery: GenerationDelivery,
  persist: () => Promise<PersistenceResult>
): Promise<boolean> {
  const { error } = await persist();
  if (error) {
    reportGenerationFailure(delivery, "persistence_failed");
    return false;
  }

  reportGenerationDelivered(delivery);
  return true;
}
