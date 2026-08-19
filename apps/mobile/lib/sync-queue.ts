import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

import {
  reportHandledOperationalError,
  reportOperationalMetric,
} from "@/lib/operational-observability";

const STORAGE_KEY = "sync-queue";
const MAX_RETRIES = 15;
const MAX_BACKOFF_MS = 60_000;

export interface SyncQueueItem {
  id: string;
  operation: string;
  payload: unknown;
  updatedAt: number;
  retryCount: number;
  nextRetryAt: number;
  createdAt: number;
  status: "pending" | "dead";
  recoveryAttempted?: boolean;
  observabilityId?: string;
}

type SyncHandler = (payload: unknown) => Promise<void>;

export class SyncQueue {
  private handlers = new Map<string, SyncHandler>();
  private items: SyncQueueItem[] = [];
  private isProcessing = false;
  private loaded = false;

  registerHandler(operation: string, handler: SyncHandler): void {
    this.handlers.set(operation, handler);
  }

  async enqueue(
    operation: string,
    id: string,
    payload: unknown
  ): Promise<void> {
    await this.load();
    const now = Date.now();

    const existingIndex = this.items.findIndex(
      (item) =>
        item.id === id &&
        item.operation === operation &&
        item.status === "pending"
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
        observabilityId: Crypto.randomUUID(),
      });
    }

    await this.persist();
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      if (!this.loaded) {
        await this.load();
      }
      const now = Date.now();
      let changed = false;
      const toRemove: number[] = [];

      for (let i = 0; i < this.items.length; i++) {
        const item = this.items[i];
        item.observabilityId ??= Crypto.randomUUID();
        if (item.status !== "pending") continue;
        if (item.nextRetryAt > now) continue;

        const handler = this.handlers.get(item.operation);
        if (!handler) continue;

        const deliveryStartedAt = Date.now();
        try {
          await handler(item.payload);
          reportOperationalMetric({
            area: "sync",
            operation: item.operation,
            journeyStage: "post_workout",
            outcome:
              item.retryCount > 0 || item.recoveryAttempted
                ? "recovered"
                : "success",
            latencyMs: Math.max(0, Date.now() - deliveryStartedAt),
            queueAgeMs: Math.max(0, Date.now() - item.createdAt),
            retryCount: item.retryCount,
            correlationId: item.observabilityId,
            dedupeKey: `${item.observabilityId}:delivered`,
          });
          toRemove.push(i);
          changed = true;
        } catch {
          item.retryCount += 1;
          if (item.retryCount >= MAX_RETRIES) {
            item.status = "dead";
            reportHandledOperationalError({
              area: "sync",
              operation: item.operation,
              journeyStage: "post_workout",
              failureCode: "sync_dead_letter",
              latencyMs: Math.max(0, Date.now() - deliveryStartedAt),
              queueAgeMs: Math.max(0, Date.now() - item.createdAt),
              retryCount: item.retryCount,
              correlationId: item.observabilityId,
              dedupeKey: `${item.observabilityId}:dead-letter`,
            });
          } else if (item.retryCount === 1) {
            reportHandledOperationalError({
              area: "sync",
              operation: item.operation,
              journeyStage: "post_workout",
              failureCode: "sync_delivery_failed",
              latencyMs: Math.max(0, Date.now() - deliveryStartedAt),
              queueAgeMs: Math.max(0, Date.now() - item.createdAt),
              retryCount: item.retryCount,
              correlationId: item.observabilityId,
              dedupeKey: `${item.observabilityId}:first-failure`,
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
    }
  }

  async flush(): Promise<void> {
    this.items = [];
    this.loaded = true;
    await AsyncStorage.removeItem(STORAGE_KEY);
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
        item.recoveryAttempted = true;
        changed = true;
      }
    }

    if (changed) {
      await this.persist();
    }
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    this.items = raw ? JSON.parse(raw) : [];
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
  }
}

export const syncQueue = new SyncQueue();
