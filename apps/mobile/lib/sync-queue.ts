import AsyncStorage from "@react-native-async-storage/async-storage";
import { z } from "zod";

import { trackEvent } from "@/lib/track-event";

const STORAGE_KEY = "sync-queue";
const MAX_RETRIES = 15;
const MAX_BACKOFF_MS = 60_000;

const syncQueueItemSchema = z
  .object({
    id: z.string().min(1),
    operation: z.string().min(1),
    payload: z.unknown(),
    updatedAt: z.number(),
    retryCount: z.number().int().nonnegative(),
    nextRetryAt: z.number(),
    createdAt: z.number(),
    status: z.enum(["pending", "dead"]),
    recoveryAttempts: z.number().int().nonnegative().default(0),
    diagnosticReference: z.string().min(1).optional(),
    version: z.number().int().positive().default(1),
  })
  .refine((item) => Object.prototype.hasOwnProperty.call(item, "payload"), {
    message: "Queue item payload is required",
  });

export interface SyncQueueItem {
  id: string;
  operation: string;
  payload: unknown;
  updatedAt: number;
  retryCount: number;
  nextRetryAt: number;
  createdAt: number;
  status: "pending" | "dead";
  recoveryAttempts: number;
  diagnosticReference: string;
  version: number;
}

export interface SyncHealthSnapshot {
  state: "saved" | "syncing" | "offline" | "failed" | "recovered";
  pendingCount: number;
  failedCount: number;
  diagnosticReference?: string;
  canContactSupport: boolean;
}

interface ParsedQueue {
  items: SyncQueueItem[];
  invalidCount: number;
  needsPersist: boolean;
}

type SyncHandler = (payload: unknown, item: SyncQueueItem) => Promise<void>;
type SyncHealthListener = () => void;

const SAVED_SNAPSHOT: SyncHealthSnapshot = {
  state: "saved",
  pendingCount: 0,
  failedCount: 0,
  canContactSupport: false,
};

function createDiagnosticReference(): string {
  const randomPart = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `SYNC-${randomPart.padEnd(8, "0")}`;
}

function parseQueue(raw: string): ParsedQueue {
  let decoded: unknown;

  try {
    decoded = JSON.parse(raw);
  } catch {
    return { items: [], invalidCount: 1, needsPersist: true };
  }

  if (!Array.isArray(decoded)) {
    return { items: [], invalidCount: 1, needsPersist: true };
  }

  const items: SyncQueueItem[] = [];
  let invalidCount = 0;
  let needsPersist = false;

  for (const entry of decoded) {
    const result = syncQueueItemSchema.safeParse(entry);
    if (!result.success) {
      invalidCount += 1;
      needsPersist = true;
      continue;
    }

    const parsed = result.data;
    const diagnosticReference =
      parsed.diagnosticReference ?? createDiagnosticReference();

    if (
      parsed.diagnosticReference === undefined ||
      !entry ||
      typeof entry !== "object" ||
      !Object.prototype.hasOwnProperty.call(entry, "version") ||
      !Object.prototype.hasOwnProperty.call(entry, "recoveryAttempts")
    ) {
      needsPersist = true;
    }

    items.push({
      id: parsed.id,
      operation: parsed.operation,
      payload: parsed.payload,
      updatedAt: parsed.updatedAt,
      retryCount: parsed.retryCount,
      nextRetryAt: parsed.nextRetryAt,
      createdAt: parsed.createdAt,
      status: parsed.status,
      recoveryAttempts: parsed.recoveryAttempts,
      diagnosticReference,
      version: parsed.version,
    });
  }

  return { items, invalidCount, needsPersist };
}

export class SyncQueue {
  private handlers = new Map<string, SyncHandler>();
  private items: SyncQueueItem[] = [];
  private isOnline = true;
  private isActive = true;
  private loaded = false;
  private hydratePromise: Promise<void> | undefined;
  private processingPromise: Promise<void> | undefined;
  private processRequested = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private storageWrite: Promise<void> = Promise.resolve();
  private recoveredReference: string | undefined;
  private snapshot = SAVED_SNAPSHOT;
  private listeners = new Set<SyncHealthListener>();

  registerHandler(operation: string, handler: SyncHandler): void {
    this.handlers.set(operation, handler);
    if (this.loaded && this.isOnline && this.isActive) {
      void this.processQueue();
    }
  }

  subscribe = (listener: SyncHealthListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getHealthSnapshot = (): SyncHealthSnapshot => this.snapshot;

  async hydrate(): Promise<void> {
    if (this.loaded) return;
    if (this.hydratePromise) return this.hydratePromise;

    this.hydratePromise = this.loadFromStorage().finally(() => {
      this.hydratePromise = undefined;
    });

    return this.hydratePromise;
  }

  setOnline(isOnline: boolean): void {
    const changed = this.isOnline !== isOnline;
    this.isOnline = isOnline;

    if (!isOnline) {
      this.clearRetryTimer();
    }

    if (changed) {
      this.publishHealth();
    }
    if (isOnline && this.isActive) {
      void this.processQueue();
    }
  }

  setActive(isActive: boolean): void {
    const changed = this.isActive !== isActive;
    this.isActive = isActive;

    if (!isActive) {
      if (changed) {
        this.clearRetryTimer();
      }
      return;
    }

    if (this.isOnline) {
      void this.processQueue();
    }
  }

  acknowledgeRecovery(): void {
    if (!this.recoveredReference) return;
    this.recoveredReference = undefined;
    this.publishHealth();
  }

  async enqueue(
    operation: string,
    id: string,
    payload: unknown
  ): Promise<void> {
    await this.hydrate();
    const now = Date.now();

    const existingIndex = this.items.findIndex(
      (item) => item.id === id && item.operation === operation
    );

    if (existingIndex !== -1) {
      const existing = this.items[existingIndex];
      this.items[existingIndex] = {
        ...existing,
        payload,
        updatedAt: now,
        retryCount: 0,
        nextRetryAt: 0,
        status: "pending",
        version: existing.version + 1,
      };
    } else {
      this.items.push({
        id,
        operation,
        payload,
        updatedAt: now,
        retryCount: 0,
        nextRetryAt: 0,
        createdAt: now,
        status: "pending",
        recoveryAttempts: 0,
        diagnosticReference: createDiagnosticReference(),
        version: 1,
      });
    }

    await this.persist();
    this.publishHealth();
    void this.processQueue();
  }

  processQueue(): Promise<void> {
    this.processRequested = true;

    if (!this.isOnline || !this.isActive) {
      return Promise.resolve();
    }

    if (this.processingPromise) {
      return this.processingPromise;
    }

    this.clearRetryTimer();
    this.processingPromise = Promise.resolve()
      .then(() => this.drainRequestedPasses())
      .finally(() => {
        this.processingPromise = undefined;
        this.publishHealth();
        this.scheduleNextRetry();
      });

    return this.processingPromise;
  }

  async flush(): Promise<void> {
    this.items = [];
    this.loaded = true;
    this.processRequested = false;
    this.recoveredReference = undefined;
    this.clearRetryTimer();
    await this.queueStorageWrite(() => AsyncStorage.removeItem(STORAGE_KEY));
    this.publishHealth();
  }

  async getDeadItems(): Promise<SyncQueueItem[]> {
    await this.hydrate();
    return this.items
      .filter((item) => item.status === "dead")
      .map((item) => ({ ...item }));
  }

  async retryDeadItems(): Promise<void> {
    await this.hydrate();
    let changed = false;

    for (const item of this.items) {
      if (item.status === "dead") {
        item.status = "pending";
        item.retryCount = 0;
        item.nextRetryAt = 0;
        item.recoveryAttempts += 1;
        item.version += 1;
        changed = true;
        trackEvent("sync_recovery_requested", {
          diagnostic_reference: item.diagnosticReference,
          operation: item.operation,
          recovery_attempt: item.recoveryAttempts,
        });
      }
    }

    if (!changed) return;

    await this.persist();
    this.publishHealth();
    await this.processQueue();
  }

  private async loadFromStorage(): Promise<void> {
    let parsed: ParsedQueue = {
      items: [],
      invalidCount: 0,
      needsPersist: false,
    };

    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        parsed = parseQueue(raw);
      }
    } catch {
      console.warn("Unable to hydrate sync queue");
    }

    this.items = parsed.items;
    this.loaded = true;
    this.publishHealth();

    if (parsed.invalidCount > 0) {
      console.warn(`Dropped ${parsed.invalidCount} invalid sync queue item(s)`);
      trackEvent("sync_queue_items_dropped", {
        invalid_count: parsed.invalidCount,
      });
    }

    if (parsed.needsPersist) {
      await this.persist();
    }
  }

  private async drainRequestedPasses(): Promise<void> {
    await this.hydrate();

    while (this.processRequested && this.isOnline && this.isActive) {
      this.processRequested = false;
      await this.processPass();
    }
  }

  private async processPass(): Promise<void> {
    const now = Date.now();
    const candidates = this.items.filter(
      (item) =>
        item.status === "pending" &&
        item.nextRetryAt <= now &&
        this.handlers.has(item.operation)
    );
    let changed = false;

    for (const item of candidates) {
      if (!this.isOnline || !this.isActive) {
        this.processRequested = true;
        break;
      }
      if (!this.items.includes(item)) continue;

      const handler = this.handlers.get(item.operation);
      if (!handler) continue;

      try {
        await handler(item.payload, item);

        const currentIndex = this.items.indexOf(item);
        if (currentIndex === -1) {
          continue;
        }

        this.items.splice(currentIndex, 1);
        changed = true;

        if (item.recoveryAttempts > 0) {
          this.recoveredReference = item.diagnosticReference;
          trackEvent("sync_recovered", {
            diagnostic_reference: item.diagnosticReference,
            operation: item.operation,
            recovery_attempt: item.recoveryAttempts,
          });
        }
      } catch {
        if (!this.items.includes(item)) {
          continue;
        }

        item.retryCount += 1;
        if (item.recoveryAttempts > 0 || item.retryCount >= MAX_RETRIES) {
          item.status = "dead";
          trackEvent("sync_failed", {
            diagnostic_reference: item.diagnosticReference,
            operation: item.operation,
            recovery_attempt: item.recoveryAttempts,
          });
        } else {
          const backoff = Math.min(
            1000 * Math.pow(2, item.retryCount),
            MAX_BACKOFF_MS
          );
          item.nextRetryAt = Date.now() + backoff;
        }
        changed = true;
      }
    }

    if (changed) {
      await this.persist();
    }
    this.publishHealth();
  }

  private persist(): Promise<void> {
    return this.queueStorageWrite(() =>
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.items))
    );
  }

  private queueStorageWrite(write: () => Promise<void>): Promise<void> {
    this.storageWrite = this.storageWrite.catch(() => undefined).then(write);
    return this.storageWrite;
  }

  private scheduleNextRetry(): void {
    this.clearRetryTimer();
    if (!this.loaded || !this.isOnline || !this.isActive) return;

    const now = Date.now();
    const nextRetryAt = this.items.reduce<number | undefined>(
      (earliest, item) => {
        if (
          item.status !== "pending" ||
          !this.handlers.has(item.operation) ||
          item.nextRetryAt <= 0
        ) {
          return earliest;
        }
        return earliest === undefined
          ? item.nextRetryAt
          : Math.min(earliest, item.nextRetryAt);
      },
      undefined
    );

    if (nextRetryAt === undefined) return;

    this.retryTimer = setTimeout(
      () => {
        this.retryTimer = undefined;
        void this.processQueue();
      },
      Math.max(0, nextRetryAt - now)
    );
  }

  private clearRetryTimer(): void {
    if (this.retryTimer === undefined) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
  }

  private publishHealth(): void {
    const failed = this.items.filter((item) => item.status === "dead");
    const pendingCount = this.items.length - failed.length;
    const firstFailed = failed[0];

    let state: SyncHealthSnapshot["state"] = "saved";
    if (failed.length > 0) {
      state = "failed";
    } else if (!this.isOnline && pendingCount > 0) {
      state = "offline";
    } else if (pendingCount > 0) {
      state = "syncing";
    } else if (this.recoveredReference) {
      state = "recovered";
    }

    const nextSnapshot: SyncHealthSnapshot = {
      state,
      pendingCount,
      failedCount: failed.length,
      diagnosticReference:
        firstFailed?.diagnosticReference ?? this.recoveredReference,
      canContactSupport: failed.some((item) => item.recoveryAttempts > 0),
    };

    if (
      this.snapshot.state === nextSnapshot.state &&
      this.snapshot.pendingCount === nextSnapshot.pendingCount &&
      this.snapshot.failedCount === nextSnapshot.failedCount &&
      this.snapshot.diagnosticReference === nextSnapshot.diagnosticReference &&
      this.snapshot.canContactSupport === nextSnapshot.canContactSupport
    ) {
      return;
    }

    this.snapshot = nextSnapshot;
    this.listeners.forEach((listener) => listener());
  }
}

export const syncQueue = new SyncQueue();
