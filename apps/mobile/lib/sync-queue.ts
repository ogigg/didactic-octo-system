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
  })
  .refine((item) => Object.prototype.hasOwnProperty.call(item, "payload"), {
    message: "Queue item payload is required",
  });

const syncQueueSchema = z.array(syncQueueItemSchema);

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
  diagnosticReference?: string;
}

export interface SyncHealthSnapshot {
  state: "saved" | "syncing" | "offline" | "failed" | "recovered";
  pendingCount: number;
  failedCount: number;
  diagnosticReference?: string;
  canContactSupport: boolean;
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

export class SyncQueue {
  private handlers = new Map<string, SyncHandler>();
  private items: SyncQueueItem[] = [];
  private isProcessing = false;
  private isOnline = true;
  private loaded = false;
  private recoveredReference: string | undefined;
  private snapshot = SAVED_SNAPSHOT;
  private listeners = new Set<SyncHealthListener>();

  registerHandler(operation: string, handler: SyncHandler): void {
    this.handlers.set(operation, handler);
  }

  subscribe = (listener: SyncHealthListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getHealthSnapshot = (): SyncHealthSnapshot => this.snapshot;

  setOnline(isOnline: boolean): void {
    if (this.isOnline === isOnline) return;
    this.isOnline = isOnline;
    this.publishHealth();
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
    await this.load();
    const now = Date.now();

    const existingIndex = this.items.findIndex(
      (item) => item.id === id && item.operation === operation
    );

    if (existingIndex !== -1) {
      const existing = this.items[existingIndex];
      if (now > existing.updatedAt) {
        this.items[existingIndex] = {
          ...existing,
          payload,
          updatedAt: now,
          retryCount: 0,
          nextRetryAt: 0,
          status: "pending",
        };
      }
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
      });
    }

    await this.persist();
    this.publishHealth();
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing || !this.isOnline) return;
    this.isProcessing = true;

    try {
      if (!this.loaded) {
        await this.load();
      }
      this.publishHealth();

      const now = Date.now();
      let changed = false;
      const toRemove: number[] = [];

      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];
        if (item.status !== "pending") continue;
        if (item.nextRetryAt > now) continue;

        const handler = this.handlers.get(item.operation);
        if (!handler) continue;

        try {
          await handler(item.payload, item);
          toRemove.push(i);
          changed = true;

          if (item.recoveryAttempts > 0) {
            this.recoveredReference = item.diagnosticReference;
            trackEvent("sync_recovered", {
              diagnostic_reference: item.diagnosticReference ?? "unknown",
              operation: item.operation,
              recovery_attempt: item.recoveryAttempts,
            });
          }
        } catch {
          item.retryCount += 1;
          if (item.recoveryAttempts > 0 || item.retryCount >= MAX_RETRIES) {
            item.status = "dead";
            item.diagnosticReference ??= createDiagnosticReference();
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

      for (let i = toRemove.length - 1; i >= 0; i--) {
        this.items.splice(toRemove[i], 1);
      }

      if (changed) {
        await this.persist();
      }
    } finally {
      this.isProcessing = false;
      this.publishHealth();
    }
  }

  async flush(): Promise<void> {
    this.items = [];
    this.loaded = true;
    this.recoveredReference = undefined;
    await AsyncStorage.removeItem(STORAGE_KEY);
    this.publishHealth();
  }

  async getDeadItems(): Promise<SyncQueueItem[]> {
    await this.load();
    return this.items.filter((item) => item.status === "dead");
  }

  async retryDeadItems(): Promise<void> {
    await this.load();
    let changed = false;

    for (const item of this.items) {
      if (item.status === "dead") {
        item.status = "pending";
        item.retryCount = 0;
        item.nextRetryAt = 0;
        item.recoveryAttempts += 1;
        changed = true;
        trackEvent("sync_recovery_requested", {
          diagnostic_reference: item.diagnosticReference ?? "unknown",
          operation: item.operation,
          recovery_attempt: item.recoveryAttempts,
        });
      }
    }

    if (changed) {
      await this.persist();
      this.publishHealth();
    }
  }

  private async load(): Promise<void> {
    if (this.loaded) return;

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      this.items = [];
    } else {
      try {
        this.items = syncQueueSchema
          .parse(JSON.parse(raw))
          .map((item): SyncQueueItem => ({ ...item, payload: item.payload }));
      } catch (error) {
        console.warn("Ignoring invalid sync queue data:", error);
        this.items = [];
      }
    }

    this.loaded = true;
    this.publishHealth();
  }

  private async persist(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
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
