# Phase 2 — Data Layer & Profile Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up TanStack Query, build a generic offline sync queue, and sync onboarding profile data to Supabase — all optimistically so the user never blocks on network.

**Architecture:** TanStack Query wraps all Supabase calls. Mutations attempt direct writes; on failure, a generic SyncQueue (AsyncStorage-backed, exponential backoff, last-write-wins) retries in the background. NetInfo and AppState trigger queue processing automatically.

**Tech Stack:** TanStack Query v5, Supabase JS, Zod, AsyncStorage, @react-native-community/netinfo, Zustand

**Spec:** `docs/superpowers/specs/2026-03-21-phase2-data-layer-profile-sync-design.md`

---

## File Map

| File                                         | Action | Responsibility                                                    |
| -------------------------------------------- | ------ | ----------------------------------------------------------------- |
| `apps/mobile/lib/query-client.ts`            | Create | QueryClient singleton with defaults                               |
| `apps/mobile/lib/query-keys.ts`              | Create | Query key factory for cache invalidation                          |
| `apps/mobile/lib/sync-queue.ts`              | Create | Generic SyncQueue class — persistence, backoff, dedup             |
| `apps/mobile/lib/api/profiles.ts`            | Create | Profile service — type mapping, Zod validation, Supabase upsert   |
| `apps/mobile/hooks/use-profile-mutations.ts` | Create | `useUpsertProfile` mutation hook with SyncQueue fallback          |
| `apps/mobile/hooks/use-profile-query.ts`     | Create | `useProfile` query hook                                           |
| `apps/mobile/app/_layout.tsx`                | Modify | Add QueryClientProvider, SyncQueue lifecycle (NetInfo + AppState) |
| `apps/mobile/app/(onboarding)/review.tsx`    | Modify | Call upsert mutation on confirm                                   |
| `apps/mobile/stores/auth-store.ts`           | Modify | Flush SyncQueue + reset onboarding store on sign-out              |

---

### Task 1: Install @react-native-community/netinfo

**Files:**

- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Install the package**

Run from `apps/mobile/`:

```bash
npx expo install @react-native-community/netinfo
```

Expected: package.json updated, lock file updated.

- [ ] **Step 2: Add to jest transformIgnorePatterns**

In `apps/mobile/jest.config.cjs`, add `@react-native-community` to the existing transformIgnorePatterns regex. It's already covered by the existing pattern `@react-native(-community)?`, so verify this by checking the regex. No change needed if already matched.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json package-lock.json apps/mobile/jest.config.cjs
git commit -m "Add @react-native-community/netinfo for offline sync detection"
```

---

### Task 2: TanStack Query client + provider (T-11)

**Files:**

- Create: `apps/mobile/lib/query-client.ts`
- Create: `apps/mobile/lib/query-keys.ts`
- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Create `lib/query-client.ts`**

```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
    },
    mutations: {
      retry: false,
    },
  },
});
```

- [ ] **Step 2: Create `lib/query-keys.ts`**

```typescript
export const profileKeys = {
  all: ["profiles"] as const,
  detail: (userId: string) => [...profileKeys.all, userId] as const,
};
```

- [ ] **Step 3: Wrap app in QueryClientProvider**

In `apps/mobile/app/_layout.tsx`:

Add import:

```typescript
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
```

Wrap the `ThemeProvider` inside `QueryClientProvider`. The JSX in the return should become:

```tsx
<View style={[styles.root, { backgroundColor: colors.background }]}>
  <AmbientGlow variant="hero" />
  <QueryClientProvider client={queryClient}>
    <ThemeProvider value={theme}>
      <Stack ...>
        {/* existing screens */}
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  </QueryClientProvider>
</View>
```

- [ ] **Step 4: Verify the app compiles**

Run from `apps/mobile/`:

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/query-client.ts apps/mobile/lib/query-keys.ts apps/mobile/app/_layout.tsx
git commit -m "Add TanStack Query provider and query key factory"
```

---

### Task 3: SyncQueue — core class with tests (T-13)

**Files:**

- Create: `apps/mobile/lib/sync-queue.ts`
- Create: `apps/mobile/lib/__tests__/sync-queue.test.ts`

- [ ] **Step 1: Write failing tests for SyncQueue**

Create `apps/mobile/lib/__tests__/sync-queue.test.ts`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

import { SyncQueue } from "../sync-queue";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe("SyncQueue", () => {
  let queue: SyncQueue;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    queue = new SyncQueue();
  });

  describe("enqueue()", () => {
    it("adds an item and persists to AsyncStorage", async () => {
      await queue.enqueue("upsert_profile", "user-1", { name: "test" });

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "sync-queue",
        expect.any(String)
      );

      const stored = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[0][1] as string
      );
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        id: "user-1",
        operation: "upsert_profile",
        payload: { name: "test" },
        status: "pending",
        retryCount: 0,
      });
    });

    it("deduplicates by id + operation using last-write-wins", async () => {
      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValueOnce(now);
      await queue.enqueue("upsert_profile", "user-1", { v: "old" });

      jest.spyOn(Date, "now").mockReturnValueOnce(now + 1000);
      await queue.enqueue("upsert_profile", "user-1", { v: "new" });

      const stored = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[1][1] as string
      );
      expect(stored).toHaveLength(1);
      expect(stored[0].payload).toEqual({ v: "new" });
    });

    it("keeps the existing item if it has a later updatedAt", async () => {
      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValueOnce(now + 1000);
      await queue.enqueue("upsert_profile", "user-1", { v: "first" });

      jest.spyOn(Date, "now").mockReturnValueOnce(now);
      await queue.enqueue("upsert_profile", "user-1", { v: "stale" });

      const stored = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[1][1] as string
      );
      expect(stored).toHaveLength(1);
      expect(stored[0].payload).toEqual({ v: "first" });
    });

    it("allows different operations for the same id", async () => {
      await queue.enqueue("upsert_profile", "user-1", { a: 1 });
      await queue.enqueue("delete_profile", "user-1", { b: 2 });

      const stored = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[1][1] as string
      );
      expect(stored).toHaveLength(2);
    });
  });

  describe("processQueue()", () => {
    it("calls the registered handler and removes item on success", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      queue.registerHandler("upsert_profile", handler);

      await queue.enqueue("upsert_profile", "user-1", { name: "test" });
      await queue.processQueue();

      expect(handler).toHaveBeenCalledWith({ name: "test" });
      // After processing, queue should be empty
      const lastCall =
        mockAsyncStorage.setItem.mock.calls[
          mockAsyncStorage.setItem.mock.calls.length - 1
        ];
      const stored = JSON.parse(lastCall[1] as string);
      expect(stored).toHaveLength(0);
    });

    it("increments retryCount and computes backoff on failure", async () => {
      const handler = jest.fn().mockRejectedValue(new Error("network"));
      queue.registerHandler("upsert_profile", handler);

      await queue.enqueue("upsert_profile", "user-1", { name: "test" });
      await queue.processQueue();

      const lastCall =
        mockAsyncStorage.setItem.mock.calls[
          mockAsyncStorage.setItem.mock.calls.length - 1
        ];
      const stored = JSON.parse(lastCall[1] as string);
      expect(stored).toHaveLength(1);
      expect(stored[0].retryCount).toBe(1);
      expect(stored[0].status).toBe("pending");
    });

    it("moves item to dead status after 15 retries", async () => {
      const handler = jest.fn().mockRejectedValue(new Error("fail"));
      queue.registerHandler("op", handler);

      // Enqueue and simulate 15 failures
      await queue.enqueue("op", "id-1", {});

      for (let i = 0; i < 15; i++) {
        // Override nextRetryAt to 0 so it's always eligible
        const lastSetCall =
          mockAsyncStorage.setItem.mock.calls[
            mockAsyncStorage.setItem.mock.calls.length - 1
          ];
        const items = JSON.parse(lastSetCall[1] as string);
        items[0].nextRetryAt = 0;
        mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(items));
        queue = new SyncQueue();
        queue.registerHandler("op", handler);
        await queue.processQueue();
      }

      const lastCall =
        mockAsyncStorage.setItem.mock.calls[
          mockAsyncStorage.setItem.mock.calls.length - 1
        ];
      const stored = JSON.parse(lastCall[1] as string);
      expect(stored[0].status).toBe("dead");
      expect(stored[0].retryCount).toBe(15);
    });

    it("skips items whose nextRetryAt is in the future", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      queue.registerHandler("op", handler);

      await queue.enqueue("op", "id-1", {});
      // Manually set nextRetryAt to the future
      const lastCall =
        mockAsyncStorage.setItem.mock.calls[
          mockAsyncStorage.setItem.mock.calls.length - 1
        ];
      const items = JSON.parse(lastCall[1] as string);
      items[0].nextRetryAt = Date.now() + 999999;
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(items));
      queue = new SyncQueue();
      queue.registerHandler("op", handler);

      await queue.processQueue();

      expect(handler).not.toHaveBeenCalled();
    });

    it("skips items with no registered handler", async () => {
      await queue.enqueue("unknown_op", "id-1", {});
      // Should not throw
      await queue.processQueue();
    });

    it("prevents concurrent processQueue calls", async () => {
      let resolveHandler: () => void;
      const handler = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveHandler = resolve;
          })
      );
      queue.registerHandler("op", handler);

      await queue.enqueue("op", "id-1", {});

      const p1 = queue.processQueue();
      const p2 = queue.processQueue();

      resolveHandler!();
      await Promise.all([p1, p2]);

      // Handler should only be called once
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("flush()", () => {
    it("clears all items from storage", async () => {
      await queue.enqueue("op", "id-1", {});
      await queue.flush();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("sync-queue");
    });
  });

  describe("getDeadItems()", () => {
    it("returns only dead items", async () => {
      // Enqueue an item and manually mark it dead via storage
      const deadItem = {
        id: "id-1",
        operation: "op",
        payload: {},
        updatedAt: Date.now(),
        retryCount: 15,
        nextRetryAt: 0,
        createdAt: Date.now(),
        status: "dead",
      };
      mockAsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify([deadItem])
      );
      queue = new SyncQueue();

      const dead = await queue.getDeadItems();
      expect(dead).toHaveLength(1);
      expect(dead[0].status).toBe("dead");
    });
  });

  describe("retryDeadItems()", () => {
    it("resets dead items to pending with retryCount 0", async () => {
      const deadItem = {
        id: "id-1",
        operation: "op",
        payload: {},
        updatedAt: Date.now(),
        retryCount: 15,
        nextRetryAt: 0,
        createdAt: Date.now(),
        status: "dead",
      };
      mockAsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify([deadItem])
      );
      queue = new SyncQueue();

      await queue.retryDeadItems();

      const lastCall =
        mockAsyncStorage.setItem.mock.calls[
          mockAsyncStorage.setItem.mock.calls.length - 1
        ];
      const stored = JSON.parse(lastCall[1] as string);
      expect(stored[0].status).toBe("pending");
      expect(stored[0].retryCount).toBe(0);
      expect(stored[0].nextRetryAt).toBe(0);
    });
  });

  describe("backoff calculation", () => {
    it("caps backoff at 60 seconds", async () => {
      const handler = jest.fn().mockRejectedValue(new Error("fail"));
      queue.registerHandler("op", handler);

      // Simulate item with retryCount 10 (2^10 * 1000 = 1024000 > 60000)
      const item = {
        id: "id-1",
        operation: "op",
        payload: {},
        updatedAt: Date.now(),
        retryCount: 10,
        nextRetryAt: 0,
        createdAt: Date.now(),
        status: "pending",
      };
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([item]));
      queue = new SyncQueue();
      queue.registerHandler("op", handler);

      const before = Date.now();
      await queue.processQueue();

      const lastCall =
        mockAsyncStorage.setItem.mock.calls[
          mockAsyncStorage.setItem.mock.calls.length - 1
        ];
      const stored = JSON.parse(lastCall[1] as string);
      // nextRetryAt should be at most 60s from now
      expect(stored[0].nextRetryAt).toBeLessThanOrEqual(before + 60001);
      expect(stored[0].retryCount).toBe(11);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `apps/mobile/`:

```bash
npx jest lib/__tests__/sync-queue.test.ts
```

Expected: FAIL — `Cannot find module '../sync-queue'`

- [ ] **Step 3: Implement SyncQueue**

Create `apps/mobile/lib/sync-queue.ts`:

```typescript
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
      // If existing is newer, keep it (discard the stale enqueue)
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
      await this.load();
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

      // Remove successful items in reverse to preserve indices
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `apps/mobile/`:

```bash
npx jest lib/__tests__/sync-queue.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/sync-queue.ts apps/mobile/lib/__tests__/sync-queue.test.ts
git commit -m "Add generic SyncQueue with exponential backoff, dedup, and persistence"
```

---

### Task 4: Profile service layer with tests (T-12 part 1)

**Files:**

- Create: `apps/mobile/lib/api/profiles.ts`
- Create: `apps/mobile/lib/api/__tests__/profiles.test.ts`

- [ ] **Step 1: Write failing tests for profile service**

Create `apps/mobile/lib/api/__tests__/profiles.test.ts`:

```typescript
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

import { supabase } from "@/lib/supabase";
import { mapOnboardingToProfile, upsertProfile } from "../profiles";
import type { Gender, Goal, Frequency } from "@/stores/onboarding-store";

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe("mapOnboardingToProfile", () => {
  it("maps standard goal and gender", () => {
    const result = mapOnboardingToProfile({
      gender: "male",
      goal: "build_strength",
      customGoal: null,
      frequency: 3,
    });

    expect(result).toEqual({
      gender: "male",
      goal: "build_strength",
      custom_goal: null,
      weekly_frequency: "3",
      onboarding_completed: true,
    });
  });

  it("maps gender 'other' to 'prefer_not_to_say'", () => {
    const result = mapOnboardingToProfile({
      gender: "other",
      goal: "lose_weight",
      customGoal: null,
      frequency: 2,
    });

    expect(result.gender).toBe("prefer_not_to_say");
  });

  it("maps null gender (skipped) to null", () => {
    const result = mapOnboardingToProfile({
      gender: null,
      goal: "improve_fitness",
      customGoal: null,
      frequency: 4,
    });

    expect(result.gender).toBeNull();
  });

  it("maps frequency 5 to '5_plus'", () => {
    const result = mapOnboardingToProfile({
      gender: "female",
      goal: "build_strength",
      customGoal: null,
      frequency: 5,
    });

    expect(result.weekly_frequency).toBe("5_plus");
  });

  it("maps frequencies 2, 3, 4 to string equivalents", () => {
    for (const freq of [2, 3, 4] as Frequency[]) {
      const result = mapOnboardingToProfile({
        gender: "male",
        goal: "build_strength",
        customGoal: null,
        frequency: freq,
      });
      expect(result.weekly_frequency).toBe(String(freq));
    }
  });

  it("infers goal='custom' when customGoal is set", () => {
    const result = mapOnboardingToProfile({
      gender: "male",
      goal: null,
      customGoal: "Run a marathon",
      frequency: 3,
    });

    expect(result.goal).toBe("custom");
    expect(result.custom_goal).toBe("Run a marathon");
  });

  it("throws on invalid state: no goal and no customGoal", () => {
    expect(() =>
      mapOnboardingToProfile({
        gender: "male",
        goal: null,
        customGoal: null,
        frequency: 3,
      })
    ).toThrow();
  });

  it("throws when custom_goal exceeds 500 chars", () => {
    expect(() =>
      mapOnboardingToProfile({
        gender: "male",
        goal: null,
        customGoal: "a".repeat(501),
        frequency: 3,
      })
    ).toThrow();
  });
});

describe("upsertProfile", () => {
  it("calls supabase upsert with mapped data and user id", async () => {
    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
    const mockSelect = jest
      .fn()
      .mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: {}, error: null }),
      });
    (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    (mockSupabase.from as jest.Mock).mockReturnValue({
      upsert: mockUpsert.mockReturnValue({ select: mockSelect }),
    });

    await upsertProfile({
      gender: "female",
      goal: "build_strength",
      customGoal: null,
      frequency: 3,
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("profiles");
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "user-123",
        gender: "female",
        goal: "build_strength",
        weekly_frequency: "3",
        onboarding_completed: true,
      })
    );
  });

  it("throws when user is not authenticated", async () => {
    (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: { message: "not authenticated" },
    });

    await expect(
      upsertProfile({
        gender: "male",
        goal: "build_strength",
        customGoal: null,
        frequency: 2,
      })
    ).rejects.toThrow("not authenticated");
  });

  it("throws when supabase upsert returns an error", async () => {
    const mockUpsert = jest.fn();
    const mockSelect = jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "RLS violation" },
      }),
    });
    (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
    (mockSupabase.from as jest.Mock).mockReturnValue({
      upsert: mockUpsert.mockReturnValue({ select: mockSelect }),
    });

    await expect(
      upsertProfile({
        gender: "male",
        goal: "build_strength",
        customGoal: null,
        frequency: 2,
      })
    ).rejects.toThrow("RLS violation");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `apps/mobile/`:

```bash
npx jest lib/api/__tests__/profiles.test.ts
```

Expected: FAIL — `Cannot find module '../profiles'`

- [ ] **Step 3: Implement the profile service**

Create `apps/mobile/lib/api/profiles.ts`:

```typescript
import { z } from "zod";

import { supabase } from "@/lib/supabase";
import type { Frequency, Gender, Goal } from "@/stores/onboarding-store";

type DbGender = "male" | "female" | "prefer_not_to_say" | null;
type DbGoal = "build_strength" | "lose_weight" | "improve_fitness" | "custom";
type DbFrequency = "2" | "3" | "4" | "5_plus";

interface ProfilePayload {
  id: string;
  gender: DbGender;
  goal: DbGoal;
  custom_goal: string | null;
  weekly_frequency: DbFrequency;
  onboarding_completed: boolean;
}

interface OnboardingData {
  gender: Gender | null;
  goal: Goal | null;
  customGoal: string | null;
  frequency: Frequency;
}

const profileSchema = z
  .object({
    gender: z.enum(["male", "female", "prefer_not_to_say"]).nullable(),
    goal: z.enum([
      "build_strength",
      "lose_weight",
      "improve_fitness",
      "custom",
    ]),
    custom_goal: z.string().max(500).nullable(),
    weekly_frequency: z.enum(["2", "3", "4", "5_plus"]),
    onboarding_completed: z.literal(true),
  })
  .refine((data) => data.goal !== "custom" || data.custom_goal !== null, {
    message: "custom_goal is required when goal is 'custom'",
  });

function mapGender(gender: Gender | null): DbGender {
  if (gender === null) return null;
  if (gender === "other") return "prefer_not_to_say";
  return gender;
}

function mapFrequency(frequency: Frequency): DbFrequency {
  if (frequency === 5) return "5_plus";
  return String(frequency) as DbFrequency;
}

function mapGoal(
  goal: Goal | null,
  customGoal: string | null
): { goal: DbGoal; custom_goal: string | null } {
  if (customGoal) {
    return { goal: "custom", custom_goal: customGoal };
  }
  if (goal) {
    return { goal, custom_goal: null };
  }
  throw new Error("Either goal or customGoal must be provided");
}

export function mapOnboardingToProfile(
  data: OnboardingData
): Omit<ProfilePayload, "id"> {
  const { goal, custom_goal } = mapGoal(data.goal, data.customGoal);

  const mapped = {
    gender: mapGender(data.gender),
    goal,
    custom_goal,
    weekly_frequency: mapFrequency(data.frequency),
    onboarding_completed: true as const,
  };

  return profileSchema.parse(mapped);
}

export async function upsertProfile(data: OnboardingData): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(authError?.message ?? "Not authenticated");
  }

  const mapped = mapOnboardingToProfile(data);
  const payload: ProfilePayload = { id: user.id, ...mapped };

  const { error } = await supabase
    .from("profiles")
    .upsert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run from `apps/mobile/`:

```bash
npx jest lib/api/__tests__/profiles.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/api/profiles.ts apps/mobile/lib/api/__tests__/profiles.test.ts
git commit -m "Add profile service with type mapping and Zod validation"
```

---

### Task 5: Profile hooks (T-12 part 2)

**Files:**

- Create: `apps/mobile/hooks/use-profile-mutations.ts`
- Create: `apps/mobile/hooks/use-profile-query.ts`

- [ ] **Step 1: Create `hooks/use-profile-query.ts`**

```typescript
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { profileKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: profileKeys.detail(user?.id ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user,
  });
}
```

- [ ] **Step 2: Create `hooks/use-profile-mutations.ts`**

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { upsertProfile } from "@/lib/api/profiles";
import { profileKeys } from "@/lib/query-keys";
import { syncQueue } from "@/lib/sync-queue";
import type { Frequency, Gender, Goal } from "@/stores/onboarding-store";

interface UpsertProfileInput {
  gender: Gender | null;
  goal: Goal | null;
  customGoal: string | null;
  frequency: Frequency;
}

export function useUpsertProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: UpsertProfileInput) => upsertProfile(data),
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({
          queryKey: profileKeys.detail(user.id),
        });
      }
    },
    onError: (_error, variables) => {
      if (user) {
        syncQueue
          .enqueue("upsert_profile", user.id, variables)
          .catch(console.warn);
      }
    },
  });
}
```

Note: This requires exporting a `syncQueue` singleton from `lib/sync-queue.ts`. Add this export at the bottom of that file:

```typescript
export const syncQueue = new SyncQueue();
```

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/hooks/use-profile-query.ts apps/mobile/hooks/use-profile-mutations.ts apps/mobile/lib/sync-queue.ts
git commit -m "Add useProfile query and useUpsertProfile mutation hooks"
```

---

### Task 6: Wire up \_layout.tsx — SyncQueue lifecycle

**Files:**

- Modify: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Add SyncQueue lifecycle effect**

In `apps/mobile/app/_layout.tsx`, add a new `useEffect` that:

1. Registers the `"upsert_profile"` handler
2. Calls `processQueue()` once to drain persisted items
3. Subscribes to NetInfo for connectivity changes
4. Subscribes to AppState for foreground events
5. Returns cleanup function

Add these imports:

```typescript
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { syncQueue } from "@/lib/sync-queue";
import { upsertProfile } from "@/lib/api/profiles";
```

Note: `AppState` is NOT already imported in `_layout.tsx` — it must be added to the `react-native` import (which currently only imports `StyleSheet` and `View`).

Add this effect inside `RootLayout`, after the existing effects:

```typescript
useEffect(() => {
  syncQueue.registerHandler("upsert_profile", (payload) =>
    upsertProfile(payload as Parameters<typeof upsertProfile>[0])
  );
  syncQueue.processQueue();

  const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      syncQueue.processQueue();
    }
  });

  const appStateSub = AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") {
      syncQueue.processQueue();
    }
  });

  return () => {
    unsubscribeNetInfo();
    appStateSub.remove();
  };
}, []);
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/_layout.tsx
git commit -m "Register SyncQueue handlers and lifecycle triggers in root layout"
```

---

### Task 7: Wire up review screen — trigger profile upsert

**Files:**

- Modify: `apps/mobile/app/(onboarding)/review.tsx`

- [ ] **Step 1: Update handleSubmit to call upsert mutation**

In `apps/mobile/app/(onboarding)/review.tsx`:

Add import:

```typescript
import { useUpsertProfile } from "@/hooks/use-profile-mutations";
```

Inside `ReviewScreen`, add the mutation hook:

```typescript
const upsertProfile = useUpsertProfile();
```

Update `handleSubmit` to call the mutation before navigating:

```typescript
function handleSubmit() {
  if (frequency === null) return;

  upsertProfile.mutate({
    gender,
    goal,
    customGoal,
    frequency,
  });

  complete();
  trackEvent("onboarding_completed", {});
  router.replace("/(tabs)" as never);
}
```

The mutation fires optimistically — the user navigates immediately. If it fails, `onError` in the hook enqueues to SyncQueue.

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(onboarding)/review.tsx
git commit -m "Trigger profile upsert on onboarding completion"
```

---

### Task 8: Sign-out cleanup

**Files:**

- Modify: `apps/mobile/stores/auth-store.ts`

- [ ] **Step 1: Add SyncQueue flush and onboarding reset to signOut**

In `apps/mobile/stores/auth-store.ts`:

Add imports:

```typescript
import { syncQueue } from "@/lib/sync-queue";
import { useOnboardingStore } from "@/stores/onboarding-store";
```

Update the `signOut` method:

```typescript
signOut: async () => {
  set({ isLoading: true });
  await supabase.auth.signOut();
  await syncQueue.flush();
  useOnboardingStore.getState().reset();
  set({ isLoading: false });
},
```

- [ ] **Step 2: Update auth-store tests**

In `apps/mobile/stores/__tests__/auth-store.test.ts`:

Add mock for sync-queue before imports:

```typescript
jest.mock("@/lib/sync-queue", () => ({
  syncQueue: {
    flush: jest.fn(),
  },
}));
```

Add mock for onboarding-store:

```typescript
jest.mock("@/stores/onboarding-store", () => ({
  useOnboardingStore: {
    getState: jest.fn().mockReturnValue({
      reset: jest.fn(),
    }),
  },
}));
```

Add a test in the `signOut()` describe block:

```typescript
it("flushes sync queue and resets onboarding store on sign out", async () => {
  const { syncQueue } = require("@/lib/sync-queue");
  const { useOnboardingStore } = require("@/stores/onboarding-store");

  (mockSupabase.auth.signOut as jest.Mock).mockResolvedValue({});

  await act(async () => {
    await useAuthStore.getState().signOut();
  });

  expect(syncQueue.flush).toHaveBeenCalledTimes(1);
  expect(useOnboardingStore.getState().reset).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 3: Run tests**

```bash
npx jest stores/__tests__/auth-store.test.ts
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/stores/auth-store.ts apps/mobile/stores/__tests__/auth-store.test.ts
git commit -m "Flush SyncQueue and reset onboarding on sign-out"
```

---

### Task 9: Run full test suite and type check

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run from `apps/mobile/`:

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Fix any failures**

If any tests fail or type errors exist, fix them before proceeding.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "Fix test/type issues from Phase 2 integration"
```
