import AsyncStorage from "@react-native-async-storage/async-storage";

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
        if (item.status !== "pending") continue;
        if (item.nextRetryAt > now) continue;

        const handler = this.handlers.get(item.operation);
        if (!handler) continue;

        try {
          await handler(item.payload);
          toRemove.push(i);
          changed = true;
        } catch {
          item.retryCount += 1;
          if (item.retryCount >= MAX_RETRIES) {
            item.status = "dead";
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
