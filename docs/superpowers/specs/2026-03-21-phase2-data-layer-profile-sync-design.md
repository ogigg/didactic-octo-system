# Phase 2 — Data Layer & Profile Sync

## Overview

Wire up TanStack Query as the server-state layer, build a generic offline sync queue, and sync onboarding data to the Supabase `profiles` table. The user experience is optimistic — the app navigates immediately after onboarding, and failed writes retry in the background.

## Prerequisites

- Install `@react-native-community/netinfo` — required for SyncQueue connectivity detection

## T-11: TanStack Query Provider

### `lib/query-client.ts`

Export a shared `QueryClient` instance with these defaults:

| Setting           | Value      | Rationale                             |
| ----------------- | ---------- | ------------------------------------- |
| `staleTime`       | 5 minutes  | Profile data changes infrequently     |
| `gcTime`          | 30 minutes | Keep cache warm across tab switches   |
| `queries.retry`   | 2          | Recover from transient network errors |
| `mutations.retry` | false      | SyncQueue handles mutation retries    |

### `app/_layout.tsx`

Wrap the `ThemeProvider` and `Stack` in `QueryClientProvider`, importing the client from `lib/query-client.ts`. The provider order from outer to inner: `QueryClientProvider` > `ThemeProvider` > `Stack`.

## T-13: Generic Offline Sync Queue

### Location

`lib/sync-queue.ts` — plain TypeScript class, not a React hook.

### Queue Item Shape

```typescript
interface SyncQueueItem<T = unknown> {
  id: string; // Record ID for deduplication (e.g. auth UID for profile upserts)
  operation: string; // Handler key, e.g. "upsert_profile"
  payload: T;
  updatedAt: number; // ms timestamp — used for last-write-wins
  retryCount: number;
  nextRetryAt: number; // ms timestamp — exponential backoff
  createdAt: number; // ms timestamp
  status: "pending" | "dead";
}
```

### Public API

| Method                            | Description                                                                                                                                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enqueue(operation, id, payload)` | Add item. If a pending item with the same `id` + `operation` exists, keep the one with the later `updatedAt` (last-write-wins).                                                                                              |
| `processQueue()`                  | Process all pending items whose `nextRetryAt` <= now. Call the registered handler for each. Remove on success. On failure: increment `retryCount`, compute next backoff. Items exceeding 15 retries move to `"dead"` status. |
| `registerHandler(operation, fn)`  | Map an operation name to an async function `(payload) => Promise<void>`.                                                                                                                                                     |
| `getDeadItems()`                  | Return items with `status: "dead"` for UI notification.                                                                                                                                                                      |
| `flush()`                         | Clear all items. Called on logout.                                                                                                                                                                                           |
| `retryDeadItems()`                | Reset dead items back to pending with `retryCount: 0` for manual recovery.                                                                                                                                                   |

### Persistence

- AsyncStorage key: `"sync-queue"`
- Serialize/deserialize on every enqueue and after processing

### Retry Strategy

- Exponential backoff: `min(1000 * 2^retryCount, 60000)` — caps at 1 minute
- Max retries: 15 — items exceeding this move to `"dead"` status

### Automatic Processing Triggers

1. **NetInfo** — When connectivity changes from offline to online, call `processQueue()`
2. **AppState** — When app returns to foreground, call `processQueue()`

Both subscriptions are set up in a `useEffect` in `app/_layout.tsx` with proper cleanup (unsubscribe on unmount).

### Concurrency

- A processing lock (boolean flag) prevents concurrent `processQueue()` calls
- Items are processed sequentially within a single `processQueue()` run

### Cleanup

- `flush()` clears all items (called on sign-out from auth store)

## T-12: Sync Onboarding to Profiles Table

### Service Layer: `lib/api/profiles.ts`

**`upsertProfile(data)`** — Accepts client-side onboarding data, maps types, and calls Supabase.

Type mappings (client -> DB):

| Field      | Client                                                   | DB                                                                                |
| ---------- | -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| gender     | `"other"`                                                | `"prefer_not_to_say"`                                                             |
| gender     | `null` (skipped)                                         | `null`                                                                            |
| frequency  | `5` (number)                                             | `"5_plus"` (string)                                                               |
| frequency  | `2 \| 3 \| 4` (number)                                   | `"2" \| "3" \| "4"` (string)                                                      |
| goal       | `"build_strength" \| "lose_weight" \| "improve_fitness"` | pass-through                                                                      |
| goal       | `null` (when `customGoal` is set)                        | `"custom"` — DB requires NOT NULL, so infer `"custom"` when `customGoal !== null` |
| customGoal | `string \| null`                                         | `custom_goal: string \| null`                                                     |

Uses `supabase.from('profiles').upsert()` with the authenticated user's ID as `id`. This handles both first-time insert and subsequent updates. The user ID is obtained from the Supabase client's persisted session (`supabase.auth.getUser()`). Sets `onboarding_completed: true`.

Note: When the SyncQueue processes items later, it relies on the Supabase client's persisted session. If the session has expired, the handler will fail and retry — the auto-refresh token will restore the session on next app foreground.

Validate the mapped payload with a Zod schema matching DB constraints:

- `goal` is NOT NULL
- `custom_goal` is required when `goal = "custom"` (CHECK constraint)
- `custom_goal` max 500 chars
- `weekly_frequency` is NOT NULL

### Mutation Hook: `hooks/use-profile-mutations.ts`

**`useUpsertProfile()`** — TanStack Query mutation:

- `mutationFn`: calls `upsertProfile()` from the service layer
- `onError`: enqueue to SyncQueue with operation `"upsert_profile"` — this makes the failure invisible to the user (optimistic)
- `onSuccess`: invalidate the profile query cache

### Query Keys: `lib/query-keys.ts`

Establish a query key factory pattern for consistent cache invalidation:

```typescript
export const profileKeys = {
  all: ["profiles"] as const,
  detail: (userId: string) => [...profileKeys.all, userId] as const,
};
```

### Query Hook: `hooks/use-profile-query.ts`

**`useProfile()`** — Fetches the current user's profile from Supabase `profiles` table using `profileKeys.detail(userId)`. Used by the Profile tab and anywhere downstream profile data is needed. Only enabled when user is authenticated.

### SyncQueue Handler Registration

In `app/_layout.tsx`, register the `"upsert_profile"` handler with the SyncQueue inside a `useEffect`. The handler calls `upsertProfile()` from the service layer. Also call `processQueue()` once after registration to drain any items persisted from a previous session.

### Onboarding Review Screen Changes (`app/(onboarding)/review.tsx`)

On "confirm" press:

1. Call `useUpsertProfile().mutate()` with data from the onboarding store
2. Navigate to `(tabs)` immediately (optimistic — don't wait for the response)
3. The mutation's `onError` callback handles enqueueing to SyncQueue

### Routing

No changes to `app/index.tsx`. Local onboarding store `isCompleted` flag continues to drive routing decisions. The profile query is consumed downstream, not for routing.

## Files Created/Modified

### New Files

- `lib/query-client.ts` — QueryClient configuration
- `lib/sync-queue.ts` — Generic SyncQueue class
- `lib/api/profiles.ts` — Profile service layer with type mapping and Zod validation
- `hooks/use-profile-mutations.ts` — `useUpsertProfile` mutation hook
- `hooks/use-profile-query.ts` — `useProfile` query hook
- `lib/query-keys.ts` — Query key factory

### Modified Files

- `app/_layout.tsx` — Add QueryClientProvider, register SyncQueue handler
- `app/(onboarding)/review.tsx` — Call upsert mutation on confirm, optimistic navigation
- `stores/auth-store.ts` — Call `syncQueue.flush()` and `onboardingStore.reset()` on sign-out

## Testing Strategy

- **SyncQueue**: Unit tests for enqueue deduplication, last-write-wins, backoff calculation, max retry -> dead status, flush
- **Profile service**: Unit tests for type mapping (gender, frequency), Zod validation, upsert call
- **Mutation hook**: Test onError enqueues to SyncQueue
- **Review screen**: Integration test for confirm flow triggering mutation and navigation

## Out of Scope

- UI notification for dead queue items (future enhancement)
- Profile editing after onboarding (future phase)
- Onboarding i18n namespace (separate concern)
