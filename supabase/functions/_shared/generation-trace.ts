import { type SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface GenerationTrace {
  id: string;
  requestId: string;
  /** Claim result lets handlers return idempotent/concurrent requests safely. */
  claimStatus?: string;
  stage(name: string, details?: Record<string, unknown>): Promise<void>;
  finish(
    status: string,
    details?: {
      generation_source?: string;
      fallback_reason?: string;
      error_code?: string;
      error_message?: string;
      final_output?: unknown;
    }
  ): Promise<void>;
}

interface TraceParams {
  requestId: string;
  userId: string;
  pendingWorkoutId?: string;
  functionName: string;
  trigger: string;
  deadlineAt?: number;
}

interface ClaimRow {
  status: string;
  attempt_id: string;
  request_id: string;
}

function asClaimRow(data: unknown): ClaimRow {
  const row = (Array.isArray(data) ? data[0] : data) as ClaimRow | null;
  if (!row?.attempt_id || !row.request_id || !row.status) {
    throw new Error("Invalid generation attempt claim response");
  }
  return row;
}

export async function createGenerationTrace(
  client: SupabaseClient,
  params: TraceParams
): Promise<GenerationTrace> {
  const { data, error } = await client.rpc("claim_generation_attempt", {
    p_user_id: params.userId,
    p_request_id: params.requestId,
    p_pending_workout_id: params.pendingWorkoutId ?? null,
    p_function_name: params.functionName,
    p_trigger: params.trigger,
  });
  if (error) throw error;

  const claim = asClaimRow(data);
  let terminal = claim.status !== "claimed";

  return {
    id: claim.attempt_id,
    requestId: claim.request_id,
    claimStatus: claim.status,
    async stage(name, details) {
      if (terminal) return;
      const now = Date.now();
      const timeoutMs = Math.min(2000, (params.deadlineAt ?? Infinity) - now);
      if (timeoutMs <= 0) return;
      const { error: stageError } = await client
        .rpc("record_generation_attempt_stage", {
          p_attempt_id: claim.attempt_id,
          p_stage: name,
          p_started_at: new Date(now).toISOString(),
          p_details: details ?? null,
        })
        .abortSignal(AbortSignal.timeout(timeoutMs));
      if (stageError) {
        console.error(
          JSON.stringify({
            event: "generation_stage_persistence_failed",
            request_id: claim.request_id,
            attempt_id: claim.attempt_id,
            stage: name,
            error: stageError.message,
          })
        );
      }
      console.log(
        JSON.stringify({
          event: "generation_stage",
          request_id: claim.request_id,
          attempt_id: claim.attempt_id,
          stage: name,
        })
      );
    },
    async finish(status, details = {}) {
      if (terminal) return;
      const { data: finishResult, error: finishError } = await client.rpc(
        "finish_generation_attempt",
        {
          p_attempt_id: claim.attempt_id,
          p_user_id: params.userId,
          p_status: status,
          p_generation_source: details.generation_source ?? null,
          p_fallback_reason: details.fallback_reason ?? null,
          p_error_code: details.error_code ?? null,
          p_error_message: details.error_message ?? null,
          p_final_output: details.final_output ?? null,
        }
      );
      if (finishError) {
        console.error(
          JSON.stringify({
            event: "generation_finish_persistence_failed",
            request_id: claim.request_id,
            attempt_id: claim.attempt_id,
            status,
            error: finishError.message,
          })
        );
      }
      console.log(
        JSON.stringify({
          event:
            finishResult === true
              ? "generation_finished"
              : "generation_finish_ignored",
          request_id: claim.request_id,
          attempt_id: claim.attempt_id,
          status: finishResult === true ? status : undefined,
          requested_status: finishResult === true ? undefined : status,
        })
      );
      if (!finishError) terminal = true;
    },
  };
}

/** Bound each database/auth round trip, including body reads, without losing caller cancellation. */
export const generationFetch: typeof fetch = (input, init) => {
  const callerSignal =
    (init as { signal?: AbortSignal | null } | undefined)?.signal ??
    (input instanceof Request ? input.signal : undefined);
  return fetch(input, {
    ...init,
    signal: AbortSignal.any([
      AbortSignal.timeout(8000),
      ...(callerSignal ? [callerSignal] : []),
    ]),
  });
};
