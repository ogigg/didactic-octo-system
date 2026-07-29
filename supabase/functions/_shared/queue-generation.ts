export interface QueueGenerationItem {
  id: string;
  queue_position: number;
  focus_area: string | null;
}

export interface QueueGenerationSuccess<TData> {
  data: TData;
  source: string;
}

export interface QueueGenerationResult {
  position: number;
  status: "ready" | "failed";
  source?: string;
  error?: string;
}

export interface QueueGenerationErrorDetails {
  item: QueueGenerationItem;
  stage: "mark_generating" | "generate" | "save_ready" | "mark_failed";
  error: string;
}

interface ProcessQueueGenerationParams<
  TItem extends QueueGenerationItem,
  TData,
> {
  items: TItem[];
  markGenerating: (item: TItem) => Promise<void>;
  generate: (item: TItem) => Promise<QueueGenerationSuccess<TData>>;
  saveReady: (
    item: TItem,
    generated: QueueGenerationSuccess<TData>
  ) => Promise<void>;
  markFailed: (item: TItem) => Promise<void>;
  logError: (details: QueueGenerationErrorDetails) => void;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function processQueueGeneration<
  TItem extends QueueGenerationItem,
  TData,
>(
  params: ProcessQueueGenerationParams<TItem, TData>
): Promise<QueueGenerationResult[]> {
  const results: QueueGenerationResult[] = [];

  for (const item of params.items) {
    let stage: QueueGenerationErrorDetails["stage"] = "mark_generating";

    try {
      await params.markGenerating(item);

      stage = "generate";
      const generated = await params.generate(item);

      stage = "save_ready";
      await params.saveReady(item, generated);

      results.push({
        position: item.queue_position,
        status: "ready",
        source: generated.source,
      });
    } catch (error) {
      const message = getErrorMessage(error);
      params.logError({ item, stage, error: message });

      try {
        await params.markFailed(item);
      } catch (markFailedError) {
        params.logError({
          item,
          stage: "mark_failed",
          error: getErrorMessage(markFailedError),
        });
      }

      results.push({
        position: item.queue_position,
        status: "failed",
        error: message,
      });
    }
  }

  return results;
}
