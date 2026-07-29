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

export class QueueFailurePersistenceError extends Error {
  readonly item: QueueGenerationItem;
  readonly generationError: string;
  readonly persistenceError: string;

  constructor(
    item: QueueGenerationItem,
    generationError: string,
    persistenceError: string
  ) {
    super(
      `Failed to persist failure for queue position ${item.queue_position}: ${persistenceError}`
    );
    this.name = "QueueFailurePersistenceError";
    this.item = item;
    this.generationError = generationError;
    this.persistenceError = persistenceError;
  }
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
  onCompleted?: (results: QueueGenerationResult[]) => Promise<void>;
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
        const persistenceError = getErrorMessage(markFailedError);
        params.logError({
          item,
          stage: "mark_failed",
          error: persistenceError,
        });
        throw new QueueFailurePersistenceError(item, message, persistenceError);
      }

      results.push({
        position: item.queue_position,
        status: "failed",
        error: message,
      });
    }
  }

  await params.onCompleted?.(results);

  return results;
}
