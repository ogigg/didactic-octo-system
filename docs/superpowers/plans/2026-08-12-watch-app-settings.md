# Apple Watch Settings Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Keep commits atomic, preserve the single WatchConnectivity application-context invariant, and validate the final flow on a physical paired iPhone and Apple Watch.

**Goal:** Add a useful Apple Watch settings screen to the iPhone app where users can shape rest flow, workout interactions, and wrist display without weakening workout sync, offline behavior, or compatibility with an older companion app.

**Architecture:** The iPhone owns a device-local, versioned Watch settings store. Workout publication keeps its existing protocol-v1 `updateApplicationContext` payload so an older installed Watch continues to receive workouts; the envelope gains optional additive settings fields that old Swift decoders ignore. Idle settings changes use a versioned `transferUserInfo` message (plus `sendMessage` when reachable), never a second application-context write. The Watch merges settings by their own monotonic revision, persists validated values in `UserDefaults`, and supplies safe defaults for every field when settings have never been received.

**Tech stack:** Expo Router, React Native, TypeScript, Zustand + AsyncStorage, Zod, Expo Modules, WatchConnectivity, SwiftUI, Observation, UserDefaults, Jest + React Native Testing Library.

**Platform references:** Apple documents that [`updateApplicationContext(_:)` replaces the current in-flight context while `transferUserInfo(_:)` queues guaranteed delivery](https://developer.apple.com/documentation/watchconnectivity/transferring-data-with-watch-connectivity). The screen intentionally stays small because Apple's [settings guidance](https://developer.apple.com/design/human-interface-guidelines/settings) recommends useful defaults and a minimal set of app-specific controls.

---

## Locked product decisions

- The settings screen lives in the **iPhone app**, reached from Profile under a new **Devices** section.
- The screen remains accessible when a Watch is unpaired, not installed, or temporarily unreachable. Those states affect status copy, not whether preferences can be edited.
- The first release includes three coherent groups instead of a token pair of toggles:
  - **Rest timer:** early-warning timing, end haptic, quick-adjust amount, automatic rest-screen presentation, and behavior when rest reaches zero.
  - **Workout interaction:** set-completion haptic and confirmations for skipping rest and ending a workout.
  - **Display:** visibility of live heart rate and previous-performance context.
- Rest and set feedback control only app-generated Watch haptics. Digital Crown haptics remain enabled and are explicitly out of scope.
- Preferences are local to this iPhone/Apple Watch pairing. They are not account data, do not use Supabase, and do not rebuild queued workouts.
- A preference change takes effect on the next matching Watch event, including during an active workout or rest timer. It must not reset the active set, rest timer, workout revision, or HealthKit session.
- `isReachable === false` means **not currently reachable**, not disconnected or broken. WatchConnectivity must queue the latest state normally.
- No setting may disable the core workout bridge or Watch HealthKit ownership in this phase.

## Proposed settings

| Setting or row | Default | Control | What it changes |
| --- | --- | --- | --- |
| Companion status | N/A | Informational status card | Paired, installed, and current reachability states; refresh on focus/foreground |
| Rest ending warning | 10 seconds | Picker: Off / 5 / 10 / 15 / 30 sec | Plays one warning haptic before zero for each rest cycle |
| Vibrate when rest ends | On | Switch | Plays the existing `.success` haptic once at zero |
| Quick rest adjustment | 15 seconds | Picker: 10 / 15 / 30 sec | Changes both Watch rest buttons to `−N` and `+N` |
| Open rest timer after a set | On | Switch | Automatically presents the rest screen after logging a nonfinal set |
| When rest ends | Stay on timer | Picker: Stay on timer / Open next set | Either preserves the READY action or clears rest and returns to the set logger |
| Vibrate when a set is logged | On | Switch | Plays the existing `.click` haptic after successful local logging |
| Confirm before skipping rest | On | Switch | Keeps or removes the second-tap skip confirmation |
| Confirm before ending workout | On | Switch | Keeps or removes the second-tap workout-end confirmation |
| Show live heart rate | On | Switch | Shows or hides heart-rate entry points; collection/HealthKit ownership is unchanged |
| Show previous performance | On | Switch | Shows or hides the LAST TIME card in the set logger |

### Later, after the underlying capability exists

| Candidate | Why it is deferred |
| --- | --- |
| Save Watch workouts to Apple Health | HealthKit ownership currently starts automatically and prevents duplicate workouts; exposing a toggle needs a separate ownership and permission design. |
| Start a workout from Watch | The current Watch waiting screen requires the phone to create the canonical session. |
| Keep screen awake / Always On behavior | Requires an explicit battery and extended-runtime policy. |
| Default set editor field | Useful, but should follow real usage data before adding another persistent preference. |
| Load adjustment step | Must wait for the kg/lb wire contract so a step never changes the wrong physical amount. |

### Do not expose on this screen

| Candidate | Why it would be misleading now |
| --- | --- |
| Default rest duration | Rest is prescribed per exercise and adjusted in-session; a Watch-only default would conflict with the canonical workout. |
| Weight units | The Watch wire types and UI currently assume kg while phone set strings can represent display units; a picker could corrupt round trips for lb users. |
| Watch language | watchOS uses its own system locale and `en.lproj` / `pl.lproj`. |
| Sound | The Watch currently uses haptics, not a configurable sound transport. |
| Global Watch haptics | The two app-haptic controls are intentionally narrow; Digital Crown feedback and system haptics should continue to follow watchOS behavior. |

---

## Sync contract and invariants

Apple documents `updateApplicationContext(_:)` as a single latest dictionary: a new call replaces the context still in flight. The current bridge also persists only one `pendingApplicationContext`. Therefore, independent workout and settings application-context writes are forbidden.

Retain the existing workout envelope and JSON `payload` byte-for-byte compatible with `WatchWorkoutSnapshot`. Add settings as an optional top-level encoded field:

```ts
export interface WatchSettingsSnapshot {
  schemaVersion: 1;
  restWarningSeconds: 0 | 5 | 10 | 15 | 30;
  restEndHapticsEnabled: boolean;
  restAdjustmentSeconds: 10 | 15 | 30;
  autoShowRestTimer: boolean;
  restCompletionBehavior: "stayOnTimer" | "openNextSet";
  setCompletionHapticsEnabled: boolean;
  confirmSkipRest: boolean;
  confirmEndWorkout: boolean;
  showHeartRate: boolean;
  showPreviousPerformance: boolean;
}

export interface WatchSettingsEnvelope {
  protocolVersion: 1;
  kind: "watchSettings";
  settingsRevision: number;
  sentAt: string;
  payload: string; // JSON-encoded WatchSettingsSnapshot
}
```

Extend `WatchSyncEnvelope` with optional `settingsRevision` and optional `watchSettingsPayload`. Every new workout application context includes those fields, while `payload` remains the legacy workout JSON and `kind` remains `workoutState | workoutEnded`. A new Watch reads both domains; an old Watch ignores the unknown top-level keys and continues decoding the workout exactly as it does today. A settings change also sends `WatchSettingsEnvelope` through `transferUserInfo` for durable idle delivery and `sendMessage` when reachable. An old Watch has no matching handler and safely ignores that message. Do not send settings via a standalone `updateApplicationContext` call, and do not bump the top-level protocol to `2`.

Required invariants:

1. Exactly one function owns `updateApplicationContext` writes.
2. Workout application-context `payload` always remains a legacy-decodable `WatchWorkoutSnapshot`; settings are additive top-level data.
3. Workout and settings use separate persisted monotonic `Int64` revisions because queued settings can arrive independently. The Watch compares each domain only with its corresponding high-water mark.
4. A settings update while idle immediately submits `transferUserInfo`; it never calls `updateApplicationContext` and never clears workout state.
5. A settings update during a workout sends only the settings message; it does not advance the workout revision or republish/restart the workout.
6. Every later workout envelope carries the current settings snapshot and settings revision, allowing the latest application context to heal a missed immediate message.
7. Terminal cancellation is published and awaited before `clearWorkout()`, preserving the existing HealthKit safety ordering.
8. On first install, absent or malformed fields resolve independently to the documented defaults. After valid settings have been received, a legacy workout envelope with no settings must retain the persisted values rather than reset them.
9. The Watch stores the last valid settings independently of the workout snapshot, so completed/cancelled/idle transitions do not erase preferences.
10. `sendMessage` is only a latency optimization. Durable settings delivery comes from `transferUserInfo`; durable workout delivery comes from the single latest application context.

Persist separate phone high-water marks such as `watch-workout-revision` and `watch-settings-revision`, and compute each next value as `max(persisted + 1, Date.now())`. This closes the existing process-restart risk where the Watch's persisted high-water marks can reject lower revisions. Defer initial publication until revision/settings hydration finishes rather than emitting revision `0`.

---

## File map

| File | Action | Responsibility |
| --- | --- | --- |
| `apps/mobile/stores/watch-settings-store.ts` | Create | Versioned local defaults, setters, hydration, and persistence |
| `apps/mobile/stores/__tests__/watch-settings-store.test.ts` | Create | Defaults, persistence/migration, malformed-state recovery |
| `apps/mobile/lib/watch-workout-sync.ts` | Modify | Add settings schemas/builders and additive workout-envelope fields |
| `apps/mobile/lib/watch-workout-publisher.ts` | Modify | Add current settings to workout envelopes and persist workout revision |
| `apps/mobile/lib/watch-settings-publisher.ts` | Create | Build/version durable settings messages and persist settings revision |
| `apps/mobile/lib/__tests__/watch-settings-publisher.test.ts` | Create | Durable delivery, coalescing, retry, and monotonic settings revision tests |
| `apps/mobile/modules/watch-bridge/src/types.ts` | Modify | Add settings snapshot/message and optional additive workout-envelope fields |
| `apps/mobile/modules/watch-bridge/src/index.ts` | Modify | Expose durable settings send without changing the workout send API |
| `apps/mobile/modules/watch-bridge/ios/WatchBridgeModule.swift` | Modify | Add `transferUserInfo`/immediate settings delivery; keep one application-context writer |
| `apps/mobile/modules/watch-bridge/ios/PhoneSessionDelegate.swift` | Modify | Persist/flush one latest workout context and pre-activation settings message |
| `apps/mobile/hooks/use-watch-bridge.ts` | Modify | Publish canonical workout snapshots and durable settings changes through their correct transports |
| `apps/mobile/hooks/use-watch-status.ts` | Create | Focus/AppState-aware paired/installed/reachable status |
| `apps/mobile/components/watch-bridge-host.tsx` | Modify | Ensure publication waits for settings/revision hydration |
| `apps/mobile/app/watch-settings.tsx` | Create | Status card and accessible setting switches |
| `apps/mobile/app/__tests__/watch-settings.test.tsx` | Create | Screen/status/toggle behavior tests |
| `apps/mobile/app/(tabs)/profile.tsx` | Modify | Add Devices section and Apple Watch row |
| `apps/mobile/app/_layout.tsx` | Modify | Register `/watch-settings` |
| `apps/mobile/components/ui/icon-symbol.tsx` | Modify | Map a Watch/device icon if the selected SF Symbol is not present |
| `apps/mobile/i18n/locales/en/watch-settings.ts` | Create | English screen strings |
| `apps/mobile/i18n/locales/pl/watch-settings.ts` | Create | Polish screen strings |
| `apps/mobile/i18n/locales/en/profile.ts` | Modify | Devices section and Apple Watch nav label |
| `apps/mobile/i18n/locales/pl/profile.ts` | Modify | Polish Devices section and Apple Watch nav label |
| `apps/mobile/i18n/resources.ts` | Modify | Register `watchSettings` in both languages |
| `apps/mobile/targets/watch/Models/WatchSettings.swift` | Create | Codable settings model, defaults, persistence, schema migration |
| `apps/mobile/targets/watch/Models/Workout.swift` | Modify | Decode additive settings fields without changing legacy workout payload decoding |
| `apps/mobile/targets/watch/ViewModels/WorkoutStore.swift` | Modify | Merge workout and settings using independent high-water marks |
| `apps/mobile/targets/watch/Services/HapticsClient.swift` | Modify | Accept explicit enabled flag for rest/set haptics |
| `apps/mobile/targets/watch/Services/WatchConnectivityClient.swift` | Modify | Receive and route durable settings user-info independently of workouts |
| `apps/mobile/targets/watch/Views/RestTimerView.swift` | Modify | Gate only rest-complete haptic |
| `apps/mobile/targets/watch/Views/ActiveWorkoutView.swift` | Modify | End confirmation and heart-rate visibility |
| `apps/mobile/targets/watch/Views/ExerciseDetailView.swift` | Modify | Rest presentation, compact running-rest access, and previous-performance visibility |
| `apps/mobile/lib/__tests__/watch-workout-sync.test.ts` | Modify | New/legacy schema and compatibility tests |
| `apps/mobile/lib/__tests__/watch-workout-publisher.test.ts` | Modify | Coalescing, revision, idle/active settings publication tests |
| `apps/mobile/README.md` | Modify | Settings ownership, compatible dual-path transport, build/manual test notes |
| `.ai/architecture.md` | Modify | Document additive settings data and the separate durable user-info path |

No migration or `.ai/db-schema.md` change is expected.

---

## Task 1: Define and test local phone preferences

**Read first:**

- `apps/mobile/stores/workout-store.ts`
- `apps/mobile/stores/onboarding-store.ts`
- `apps/mobile/__mocks__/zustand-middleware.js`

**Files:** Create `apps/mobile/stores/watch-settings-store.ts`; create `apps/mobile/stores/__tests__/watch-settings-store.test.ts`.

- [ ] Define `WatchSettingsState` from the exact `WatchSettingsSnapshot` fields above, plus `hasHydrated`, one typed setter per field, and `setHasHydrated`.
- [ ] Export immutable defaults: `restWarningSeconds: 10`, `restEndHapticsEnabled: true`, `restAdjustmentSeconds: 15`, `autoShowRestTimer: true`, `restCompletionBehavior: "stayOnTimer"`, `setCompletionHapticsEnabled: true`, `confirmSkipRest: true`, `confirmEndWorkout: true`, `showHeartRate: true`, and `showPreviousPerformance: true`.
- [ ] Persist as `watch-app-settings-storage`, store version `1`, using `createJSONStorage(() => AsyncStorage)` and `partialize` so `hasHydrated` is not persisted.
- [ ] Add a migration/safe merge that treats missing, non-boolean, or future malformed values as the default `true` instead of trusting unchecked storage.
- [ ] Mark hydration complete through `onRehydrateStorage`, including the error path; log a scoped warning and retain defaults on error.
- [ ] Test first-run defaults, each setter independently, every allowed picker value, missing v0 fields receiving their field default, invalid enum/numeric values receiving their field default, and hydration completion.

**Acceptance criteria:**

- The store contains no user/account/workout fields and performs no Supabase call.
- Updating one field does not change any sibling field.
- A missing persisted field restores that field's documented default.
- `cd apps/mobile && npx jest stores/__tests__/watch-settings-store.test.ts --runInBand` exits `0`.

## Task 2: Add a backward-compatible settings wire contract

**Read first:**

- `apps/mobile/modules/watch-bridge/src/types.ts`
- `apps/mobile/lib/watch-workout-sync.ts`
- `apps/mobile/lib/__tests__/watch-workout-sync.test.ts`
- `apps/mobile/targets/watch/Models/Workout.swift`

**Files:** Modify the four files above; create `apps/mobile/targets/watch/Models/WatchSettings.swift`.

- [ ] Add the TypeScript interfaces shown in **Sync contract and invariants** and Zod schemas for the settings snapshot/message crossing the native boundary.
- [ ] Add optional `settingsRevision` and `watchSettingsPayload` to `WatchSyncEnvelope`; do not change its existing `kind` union or the JSON shape stored in `payload`.
- [ ] Implement `buildWatchSettingsSnapshot(state)` and `makeWatchSettingsEnvelope(snapshot, settingsRevision)` with schema version `1`.
- [ ] Extend `makeWatchEnvelope` to accept the current settings snapshot/revision and serialize them into the new top-level optional fields while retaining the legacy workout payload and native acknowledgement injection.
- [ ] Add a byte/shape compatibility fixture proving the new envelope's `payload` still parses directly as `WatchWorkoutSnapshot`.
- [ ] In Swift, define `WatchSettingsSnapshot` with the same closed numeric/string domains and field-by-field first-install defaults; store valid settings under `SweatyWatch.settings.v1` and the high-water mark under `SweatyWatch.settingsRevision`.
- [ ] Extend Swift `WatchSyncEnvelope` to decode its workout exactly as today and optionally decode settings from the additive top-level fields. Define a separate `WatchSettingsEnvelope` decoder for `kind == "watchSettings"` user-info/messages.
- [ ] Reject unsupported protocol versions and invalid/nonpositive domain revisions without replacing the last valid state.

**Acceptance criteria:**

- A current v1 workout fixture still decodes on the new Watch; on first install absent settings use every documented default.
- A new settings-only user-info message decodes and updates settings without containing a workout.
- A new workout envelope's `payload` decodes successfully with the old `WatchWorkoutSnapshot` decoder.
- Unknown additive JSON fields are ignored.
- Invalid fields do not crash or replace valid sibling/persisted values; first install receives safe field defaults.
- Existing stable IDs, rest dates, command payloads, and `Int64` revisions are unchanged.
- `cd apps/mobile && npx jest lib/__tests__/watch-workout-sync.test.ts --runInBand` exits `0`.

## Task 3: Make both delivery paths durable, compatible, and monotonic

**Read first:**

- `apps/mobile/lib/watch-workout-publisher.ts`
- `apps/mobile/hooks/use-watch-bridge.ts`
- `apps/mobile/components/watch-bridge-host.tsx`
- `apps/mobile/modules/watch-bridge/src/index.ts`
- `apps/mobile/modules/watch-bridge/ios/WatchBridgeModule.swift`
- `apps/mobile/modules/watch-bridge/ios/PhoneSessionDelegate.swift`
- `apps/mobile/app/workout.tsx` (discard ordering)

**Files:** Modify the files above and `apps/mobile/lib/__tests__/watch-workout-publisher.test.ts`; create `apps/mobile/lib/watch-settings-publisher.ts` and `apps/mobile/lib/__tests__/watch-settings-publisher.test.ts`.

- [ ] Keep `sendWorkoutState` as the only application-context API. Add `sendWatchSettings`, implemented with `transferUserInfo` plus an immediate `sendMessage` when reachable; it must never call `updateApplicationContext`.
- [ ] Until WCSession is activated, paired, and the companion is installed, persist only the latest unsent settings envelope in native UserDefaults. After `transferUserInfo` accepts it, clear that pre-delivery slot because WatchConnectivity owns durable delivery; flush it on activation and `sessionWatchStateDidChange`.
- [ ] On every workout publication, read current `useWatchSettingsStore` values and attach them with the current persisted settings revision as optional top-level fields.
- [ ] Subscribe to Watch settings changes after hydration. Coalesce synchronous changes into one microtask/short debounce, create one new settings revision, and submit one durable settings message.
- [ ] Do not make the workout-store subscription react to settings-only changes. The next real active/completed/cancelled workout publication carries the latest settings revision; never manufacture `workout: null` or a synthetic workout.
- [ ] Persist and hydrate separate last-sent workout and settings revisions, then compute `max(lastRevision + 1, Date.now())` for each domain.
- [ ] Keep workout-native ordering: persist the latest workout envelope first, call `updateApplicationContext`, then use `sendMessage` only when installed and reachable.
- [ ] Preserve `acknowledgedCommandIDs` on every context so the Watch outbox continues draining.
- [ ] Preserve `publishCancelledWorkoutToWatch` semantics: await a terminal cancelled context before clearing phone workout state.
- [ ] On Watch, add `didReceiveUserInfo` and route `watchSettings` messages separately from workout envelopes. Apply only settings revisions greater than the persisted settings high-water mark; queued older toggles may arrive but must not win.
- [ ] Report send failures with redacted reason codes only; never log payloads, workout names, heart rate, command IDs, or HealthKit UUIDs.

**Tests:**

- [ ] No-op and return `false` on non-iOS/unpaired.
- [ ] Settings-only publication uses `transferUserInfo`, contains no workout, and carries both current flags plus a settings revision.
- [ ] Active workout publication retains the exact legacy workout payload/ID/rest end date and carries the latest additive settings fields.
- [ ] Workout mutation retains the latest settings.
- [ ] Repeated publications are strictly monotonic within each revision domain after simulated process hydration.
- [ ] Reordered settings messages cannot override a newer applied preference.
- [ ] Failed settings submission retains the pre-activation pending envelope; failed workout send does not clear the latest workout context.
- [ ] Cancellation is sent before the caller can clear state.

**Acceptance criteria:**

- A repository search finds only one production `updateApplicationContext(` call path.
- There is no standalone settings application-context write.
- A new phone envelope remains consumable by the current old Watch workout decoder; an old phone envelope remains consumable by the new Watch.
- Phone restart cannot produce a domain revision below the corresponding persisted Watch high-water mark under normal clock conditions.
- `cd apps/mobile && npx jest lib/__tests__/watch-workout-publisher.test.ts lib/__tests__/watch-workout-sync.test.ts --runInBand` exits `0`.

## Task 4: Apply the preferences on Watch without changing workout behavior

**Read first:**

- `apps/mobile/targets/watch/ViewModels/WorkoutStore.swift`
- `apps/mobile/targets/watch/Services/HapticsClient.swift`
- `apps/mobile/targets/watch/Views/RestTimerView.swift`
- `apps/mobile/targets/watch/Views/SetLoggerView.swift`
- `apps/mobile/targets/watch/Views/ExerciseDetailView.swift`
- `apps/mobile/targets/watch/Views/ActiveWorkoutView.swift`
- `apps/mobile/targets/watch/Services/WatchConnectivityClient.swift`

**Files:** Modify the Watch files above; use the `WatchSettings.swift` model created in Task 2.

- [ ] Add `private(set) var watchSettings` and `private(set) var settingsRevision` to `WorkoutCoordinator`, initialized from namespaced UserDefaults with defaults on missing/corrupt data.
- [ ] Parse and compare the two domains independently. Merge optional settings whenever their revision is newer, even if the workout revision is stale; apply workout/HealthKit flow only when the workout revision is newer.
- [ ] When a settings-only user-info/message arrives, persist and apply only the settings domain. It must never assign `snapshot`, change `screen`, call `manageHealthWorkout()`, or acknowledge/mutate the workout command outbox.
- [ ] Add a distinct, restrained `HapticsClient.restTimerWarning()` pattern and keep `restTimerComplete()` / `setCompleted()`. The caller decides whether each plays; Digital Crown feedback is never routed through these preferences.
- [ ] Track warning and completion delivery by stable `rest.id`, not view mount. For each rest cycle, fire the warning at most once when running time crosses from above to at/below `restWarningSeconds`, and completion at most once when it crosses zero. Paused timers do not alert; adding time after an alert does not replay it.
- [ ] If warning timing changes while the current timer is already below the new threshold, do not fire a catch-up haptic; apply the new warning on the next rest cycle. `0` means no early warning.
- [ ] Render adjustment buttons from `restAdjustmentSeconds` and continue sending the existing stable-rest-ID `adjustRest` command with `±N`.
- [ ] After a nonfinal set is logged, open `RestTimerView` only when `autoShowRestTimer` is true. When false, remain on the exercise screen and show a compact, accessible running-rest button so the user can still open the timer.
- [ ] At zero, `stayOnTimer` preserves the READY screen and Start next set action. `openNextSet` calls the existing stable-rest-ID skip/clear path exactly once and returns to `.activeSet`.
- [ ] Pass `setCompletionHapticsEnabled` from `completeCurrentSet()` so disabling feedback never changes optimistic completion or command delivery.
- [ ] Read `confirmSkipRest` and `confirmEndWorkout` in the existing two-tap confirmation flows. Turning either off performs the same existing action on the first tap; destructive styling/accessibility labels remain explicit.
- [ ] Hide every `HeartRateButton` when `showHeartRate` is false, but do not stop HealthKit collection, workout ownership, or workout background execution.
- [ ] Hide only the LAST TIME prescription card when `showPreviousPerformance` is false; keep target, set history, notes, and logging controls unchanged.
- [ ] Do not change `SetLoggerView.digitalCrownRotation(... isHapticFeedbackEnabled: true)`.
- [ ] Ensure settings changes during a rest timer do not reset alert-delivery state, the absolute end date, screen, workout revision, or command outbox.

**Acceptance criteria:**

- Warning `0` plays no early alert; `5/10/15/30` plays exactly once at the selected crossing per rest ID.
- With end haptics off, crossing zero plays no `.success`; with it on, it plays exactly once.
- With set haptics off, logging a set plays no `.click` but still optimistically completes and enqueues exactly one command.
- Each rest adjustment value renders and sends the exact selected delta.
- Auto-show off retains a discoverable running timer; auto-open-next-set performs one rest-clear command and never skips a set.
- Both confirmation preferences change only their respective first/second-tap behavior.
- Heart-rate and previous-performance switches change visibility only, not stored workout data.
- Digital Crown feedback remains enabled for every preference combination.
- Settings survive Watch app termination/relaunch and valid app updates; reinstall behavior resets to documented defaults.
- HealthKit start/end ownership and UUID correlation are unchanged.

## Task 5: Add companion status and the iPhone settings screen

**Read first:**

- `apps/mobile/app/(tabs)/profile.tsx`
- `apps/mobile/app/health-settings.tsx`
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/components/ui/list-row.tsx`
- `apps/mobile/modules/watch-bridge/src/index.ts`
- `apps/mobile/hooks/use-health-status.ts`

**Files:** Create `apps/mobile/hooks/use-watch-status.ts`, `apps/mobile/app/watch-settings.tsx`, and `apps/mobile/app/__tests__/watch-settings.test.tsx`; modify route/profile/icon files from the file map.

- [ ] Add a Devices section below Training in Profile with an Apple Watch row. Keep it visible on every platform; on non-iOS it opens the explanatory screen rather than becoming a dead control.
- [ ] Register `watch-settings` with `headerShown: false` and render a `ScreenHeader`, subtle `AmbientGlow`, `SafeAreaView`, and `ScrollView` using existing theme tokens and `StyleSheet.create()`.
- [ ] Implement a `useWatchStatus` hook that returns `platformSupported`, `paired`, `installed`, and `reachable`. Refresh on focus and when `AppState` becomes active. Do not rely on the booleans before WCSession activation without a refresh/loading state.
- [ ] Render these mutually exclusive status messages:
  - non-iOS: **Apple Watch is available with the iPhone app.**
  - iOS, not paired: **No Apple Watch paired. Your preferences will be saved for later.**
  - paired, not installed: **Companion not installed. Install Sweaty from the Watch app on iPhone.**
  - paired + installed + unreachable: **Installed. Changes will sync when your Watch reconnects.**
  - paired + installed + reachable: **Connected and ready.**
- [ ] Do not render red/error styling for ordinary unreachable state. Use neutral/muted styling and a green/success state only for ready.
- [ ] Render three localized groups: **Rest timer**, **Workout interaction**, and **Display**. Use `ListRow` with a trailing React Native `Switch` for booleans and an accessible inline single-select choice row for closed-value settings.
- [ ] Choice rows expose the group label plus selected value to accessibility, mark exactly one option selected, and use these options: warning `Off/5s/10s/15s/30s`, adjustment `10s/15s/30s`, completion `Stay on timer/Open next set`.
- [ ] Set switch accessibility role/state/label/hint explicitly. Persist switches and choice selections immediately.
- [ ] Keep all controls editable on iPhone when unpaired/uninstalled/unreachable, with helper copy explaining queued application. Disable them only on non-iOS, where no Apple Watch companion can exist.
- [ ] Do not add a Save button: changes are local, immediate, and last-write-wins.

**Screen tests:**

- [ ] Profile's Apple Watch row navigates to `/watch-settings`.
- [ ] All five status matrices render the exact intended copy; unreachable is not described as an error.
- [ ] Every field starts at its documented default, exposes its accessible checked/selected state, and updates independently.
- [ ] Toggle changes update the store and request one coalesced durable settings publication.
- [ ] Picker changes update the store and publish the exact allowed value; invalid arbitrary values cannot be entered.
- [ ] The screen remains readable/actionable while unpaired or not installed and explains non-iOS support.

**Acceptance criteria:**

- No user-facing Watch settings string is hardcoded in JSX.
- Accessibility queries can find every switch and selection group by localized label.
- `cd apps/mobile && npx jest app/__tests__/watch-settings.test.tsx --runInBand` exits `0`.

## Task 6: Add English and Polish copy

**Read first:**

- `.ai/i18n.md`
- `apps/mobile/i18n/resources.ts`
- `apps/mobile/i18n/locales/en/profile.ts`
- `apps/mobile/i18n/locales/pl/profile.ts`
- `apps/mobile/targets/watch/en.lproj/Localizable.strings`
- `apps/mobile/targets/watch/pl.lproj/Localizable.strings`

**Files:** Create/register both `watch-settings.ts` namespaces and update both profile namespaces. Watch UI gains no new user-facing setting control in this phase, so only add Swift localization keys if native diagnostics become visible.

Use these English labels as the source copy:

- Title: `Apple Watch`
- Section: `Devices`
- Intro: `Start workouts on iPhone, then log sets, manage rest, and view heart rate from your wrist.`
- Group: `Rest timer`
- Warning: `Rest ending warning` / `Get a tap before your rest reaches zero.`
- End haptic: `Vibrate when rest ends` / `Feel a success tap when your rest reaches zero.`
- Adjustment: `Quick adjustment` / `Choose how much the − and + buttons change the timer.`
- Auto-show: `Open rest timer after a set` / `Show the countdown automatically after logging a set.`
- At zero: `When rest ends` / options `Stay on timer`, `Open next set`
- Group: `Workout interaction`
- Set haptic: `Vibrate when a set is logged` / `Get a light tap after logging each set.`
- Skip confirmation: `Confirm before skipping rest` / `Require a second tap before ending a rest early.`
- End confirmation: `Confirm before ending workout` / `Require a second tap before finishing the workout.`
- Group: `Display`
- Heart rate: `Show live heart rate` / `Show heart rate controls during a Watch workout.`
- Previous performance: `Show previous performance` / `Show your last result beside the current set target.`
- Shared choice labels: `Off`, `5 sec`, `10 sec`, `15 sec`, `30 sec`

Translate naturally into Polish, preserving “Apple Watch” and the narrow distinction between rest and set haptics. Run the existing locale parity test and add the new namespace to its coverage if necessary.

Use this Polish source copy so implementation does not require product decisions:

- Title: `Apple Watch`
- Section: `Urządzenia`
- Intro: `Rozpocznij trening na iPhonie, a następnie zapisuj serie, zarządzaj przerwami i sprawdzaj tętno na nadgarstku.`
- Group: `Minutnik przerwy`
- Warning: `Ostrzeżenie przed końcem przerwy` / `Poczuj stuknięcie, zanim minutnik przerwy dojdzie do zera.`
- End haptic: `Wibracja po zakończeniu przerwy` / `Poczuj potwierdzające stuknięcie, gdy przerwa dojdzie do zera.`
- Adjustment: `Szybka zmiana czasu` / `Wybierz, o ile przyciski − i + zmieniają czas przerwy.`
- Auto-show: `Otwieraj minutnik po serii` / `Automatycznie pokaż odliczanie po zapisaniu serii.`
- At zero: `Po zakończeniu przerwy` / options `Pozostań na minutniku`, `Otwórz następną serię`
- Group: `Obsługa treningu`
- Set haptic: `Wibracja po zapisaniu serii` / `Poczuj lekkie stuknięcie po zapisaniu każdej serii.`
- Skip confirmation: `Potwierdzaj pominięcie przerwy` / `Wymagaj drugiego stuknięcia przed wcześniejszym zakończeniem przerwy.`
- End confirmation: `Potwierdzaj zakończenie treningu` / `Wymagaj drugiego stuknięcia przed zakończeniem treningu.`
- Group: `Wyświetlanie`
- Heart rate: `Pokazuj tętno na żywo` / `Pokazuj funkcje tętna podczas treningu na zegarku.`
- Previous performance: `Pokazuj poprzedni wynik` / `Pokazuj ostatni wynik obok celu bieżącej serii.`
- Shared choice labels: `Wyłączone`, `5 s`, `10 s`, `15 s`, `30 s`
- Non-iOS: `Apple Watch jest dostępny w aplikacji na iPhone’a.`
- Not paired: `Brak sparowanego Apple Watch. Twoje preferencje zostaną zachowane na później.`
- Not installed: `Aplikacja na zegarku nie jest zainstalowana. Zainstaluj Sweaty w aplikacji Watch na iPhonie.`
- Unreachable: `Aplikacja jest zainstalowana. Zmiany zsynchronizują się, gdy Apple Watch ponownie się połączy.`
- Ready: `Połączono i gotowe.`

**Acceptance criteria:**

- `resources.en.watchSettings` and `resources.pl.watchSettings` have identical key structure.
- `cd apps/mobile && npx jest i18n/__tests__/polish-locales.test.ts --runInBand` exits `0`.

## Task 7: Document, validate, and stage rollout

**Read first:**

- `apps/mobile/README.md`
- `.ai/architecture.md`
- `project-wiki/guides/running-and-releasing-mobile-app.md`
- `apps/mobile/targets/watch/expo-target.config.json`
- `apps/mobile/targets/watch/Info.plist`

**Files:** Modify `apps/mobile/README.md` and `.ai/architecture.md`; update analytics docs only if events are added.

- [ ] Document phone ownership, local-only persistence, every default, the single workout application context plus durable settings user-info transport, legacy v1 compatibility, and how unreachable delivery behaves.
- [ ] Document that the settings do not affect phone notifications/sounds, Digital Crown haptics, Watch language, units, or HealthKit recording.
- [ ] If analytics are added, limit them to `watch_settings_viewed` and `watch_setting_changed` with low-cardinality `setting` and `value`. Do not record workout/exercise names, heart rate, command IDs, HealthKit UUIDs, or raw payloads.
- [ ] Add redacted native log categories for connectivity/settings errors only if the project already has an `os.Logger` pattern; otherwise retain scoped warnings and avoid expanding observability scope.

### Automated verification

From repository root:

```bash
npm run format:check
npm run check-types
npm run lint
npm run test
```

Focused mobile verification:

```bash
cd apps/mobile
npx jest stores/__tests__/watch-settings-store.test.ts \
  lib/__tests__/watch-workout-sync.test.ts \
  lib/__tests__/watch-workout-publisher.test.ts \
  lib/__tests__/watch-settings-publisher.test.ts \
  app/__tests__/watch-settings.test.tsx \
  i18n/__tests__/polish-locales.test.ts --runInBand
```

Native regeneration/build after adding Swift files:

```bash
cd apps/mobile
npx expo prebuild -p ios --clean
cd ios
pod install
xcodebuild -workspace Sweaty.xcworkspace -scheme SweatyWatch build
```

### Physical device acceptance matrix

WatchConnectivity, HealthKit, and physical haptics require a paired iPhone and Apple Watch.

- [ ] Fresh install: every field matches the documented defaults; the 10-second warning is the only intentionally new feedback.
- [ ] Change every preference independently while idle; terminate/relaunch both apps; state persists.
- [ ] Test rest warning Off/5/10/15/30, pause across the threshold, add time after warning, and one alert per stable rest ID.
- [ ] Toggle end haptic during an active countdown; timer/end date do not change; the next zero crossing honors the new value.
- [ ] Test adjustment 10/15/30; both labels and phone-side stable-rest-ID deltas match exactly.
- [ ] Test auto-show off and both rest-completion behaviors; the timer remains discoverable and automatic next-set navigation sends one clear command.
- [ ] Toggle set haptic on the set logger; next logged set honors it; completion reaches phone exactly once.
- [ ] Test both confirmation settings on/off, including accidental single taps and VoiceOver labels.
- [ ] Hide/show heart rate and previous performance; HealthKit collection, target display, and logged values remain unchanged.
- [ ] Digital Crown continues haptic feedback with all app haptic settings off.
- [ ] Phone backgrounded / Watch unreachable: setting remains saved; queued settings user-info and latest workout context arrive after reconnect; no workout or rest state disappears.
- [ ] Companion not installed: changing preferences never rejects or blocks phone UI; install later and receive latest settings plus latest workout state.
- [ ] Kill/relaunch phone during an active rest: next revision exceeds Watch high-water; timer resumes from absolute end date.
- [ ] Kill/relaunch Watch: settings and command outbox persist; no duplicated set completion/rest adjustment.
- [ ] Cancel on phone: terminal context reaches Watch before phone state clears; Watch ends HealthKit once.
- [ ] Finish on Watch: phone saves one summary and does not create a duplicate HealthKit workout.
- [ ] Old Watch + new phone: legacy Watch continues receiving workout state and safely ignores unknown settings data/messages; no silent workout loss.
- [ ] New Watch + old phone: legacy workout payload decodes and every setting uses its documented default.
- [ ] English and Polish, VoiceOver, smallest/largest supported Watch sizes, long exercise names, and large text remain usable.

### Rollout recommendation

1. Internal TestFlight with physical-device matrix and old/new build pairing.
2. Small phased iOS release; monitor publication failures, rejected/duplicate command rate, outbox age, and HealthKit terminal failures. Ordinary unreachable state is not an alert condition.
3. Expand after at least one day without workout-state loss or duplicate mutations. The settings UI can be feature-flagged, but the additive envelope decoder and legacy workout payload must remain backward compatible once released.

---

## Definition of done

- The iPhone Profile contains a localized Apple Watch settings entry and screen.
- Rest, workout-interaction, and display preferences persist locally and update independently without a Save step.
- The Watch honors warning timing, end behavior, adjustment size, automatic presentation, confirmations, haptics, and display choices without changing Digital Crown or HealthKit behavior.
- Workouts retain one durable latest application context; settings use durable queued user-info plus additive workout-envelope fields, with independent monotonic revisions.
- Offline, unreachable, uninstalled, restart, cancel, and finish paths do not lose workout state or duplicate commands/HealthKit workouts.
- Old/new phone and Watch combinations have documented, tested defaults or an explicit safe feature gate.
- Type checks, lint, Jest, Watch build, and physical-device acceptance pass.
- `apps/mobile/README.md` and `.ai/architecture.md` describe the implemented behavior.
