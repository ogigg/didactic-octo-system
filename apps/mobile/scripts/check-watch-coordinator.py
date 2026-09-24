#!/usr/bin/env python3
"""Run the real watch coordinator against in-memory platform clients on macOS."""
from pathlib import Path
import subprocess
import uuid

root = Path(__file__).resolve().parents[1] / "targets/watch"
domain = "SweatyWatch.Check." + str(uuid.uuid4())
source = "import Foundation\n"
for name in ["Models/RestTimer.swift", "Models/Workout.swift", "ViewModels/WorkoutStore.swift"]:
    source += (root / name).read_text().replace("import Observation", "").replace(
        "import UserNotifications", ""
    ).replace("@Observable", "").replace("@MainActor", "").replace(
        "UserDefaults.standard", f'UserDefaults(suiteName: "{domain}")!'
    ) + "\n"
source += r'''
final class WatchConnectivityClient {
    var onEnvelope: ((WatchSyncEnvelope) -> Void)?
    var outbox: [WatchCommand] = []
    func activate() {}
    func requestState() {}
    func waitForPendingContent() async {}
    func enqueue(_ command: WatchCommand) { outbox.append(command) }
}
final class HealthKitClient {
    struct Receipt { var workoutID: String; var healthWorkoutUUID: UUID }
    var pendingSavedWorkout: Receipt?
    func acknowledgeSavedWorkout(workoutID: String) {}
    var heartRate: Int?
    var activeWorkoutID: String?
    var isSessionActive = false
    var onFailure: ((Error) -> Void)?
    func startWorkout(workoutID: String, at: Date) async -> Bool { false }
    func recoverActiveWorkoutSession() async -> Bool { false }
    func endWorkout(at: Date = .now, discard: Bool = false, expectedWorkoutID: String? = nil) async -> UUID? { nil }
}
enum HapticsClient { static func setCompleted() {}; static func restTimerComplete() {} }
struct NotificationOptions: OptionSet {
    let rawValue: Int
    static let alert = NotificationOptions(rawValue: 1)
    static let sound = NotificationOptions(rawValue: 2)
}
struct NotificationSound { static let `default` = NotificationSound() }
final class UNMutableNotificationContent { var title = ""; var body = ""; var sound: NotificationSound? }
struct UNTimeIntervalNotificationTrigger { init(timeInterval: Double, repeats: Bool) {} }
struct UNNotificationRequest { init(identifier: String, content: UNMutableNotificationContent, trigger: UNTimeIntervalNotificationTrigger) {} }
final class UNUserNotificationCenter {
    static func current() -> UNUserNotificationCenter { UNUserNotificationCenter() }
    func removePendingNotificationRequests(withIdentifiers: [String]) {}
    func requestAuthorization(options: NotificationOptions) async throws -> Bool { false }
    func add(_ request: UNNotificationRequest) async throws {}
}
func set(_ id: String, completed: Bool = false, reps: Double = 10) -> WatchSet {
    WatchSet(id: id, type: .working, targetLoadKg: 20, targetReps: reps, isCompleted: completed)
}
func exercise(_ id: String, sets: [WatchSet]) -> WatchExercise {
    WatchExercise(id: id, catalogExerciseId: id, name: id, exerciseType: .weight, restDurationSeconds: 60, sets: sets)
}
func fixture() -> WatchWorkoutSnapshot {
    WatchWorkoutSnapshot(workoutId: "check", name: "Check", status: .active, startedAt: .now,
        selectedExerciseId: "a", exercises: [exercise("a", sets: [set("a1"), set("a2", reps: 5)]),
        exercise("b", sets: [set("b1")])])
}
func envelope(_ snapshot: WatchWorkoutSnapshot, revision: Int64 = 100) -> WatchSyncEnvelope {
    let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
    return WatchSyncEnvelope(dictionary: ["protocolVersion": 1, "revision": revision,
        "payload": String(data: try! encoder.encode(snapshot), encoding: .utf8)!])!
}
let draftStore = WorkoutCoordinator()
draftStore.apply(envelope(fixture()))
draftStore.updateEditor(loadKg: 41, reps: 9)
var selectedElsewhere = fixture()
selectedElsewhere.selectedExerciseId = "b"
draftStore.apply(envelope(selectedElsewhere, revision: 101))
assert(draftStore.connectivity.outbox.contains { $0.type == .updateSet && $0.decodedPayload["setId"] as? String == "a1" }, "Phone selection must enqueue the old editor draft")
assert(draftStore.snapshot?.exercises[0].sets[0].actualLoadKg == 41)
draftStore.navigate(.details)
draftStore.navigate(.heartRate)
draftStore.goBack()
assert(draftStore.screen == .details)
draftStore.goBack()
assert(draftStore.screen == .exerciseList)
let store = WorkoutCoordinator()
store.apply(envelope(fixture()))
store.selectExercise("a")
store.completeCurrentSet()
assert(store.snapshot?.rest != nil, "Offline completion must create rest")
assert(store.reps == 5, "Next set editor must use next prescription")
store.pauseRest()
assert(store.snapshot?.rest?.isPaused == true)
store.adjustRest(by: 15)
assert(store.snapshot!.rest!.remainingSeconds() >= 74)
store.resumeRest()
assert(store.snapshot?.rest?.isPaused == false)
store.skipRest()
assert(store.screen == .activeSet && store.snapshot?.rest == nil)
store.updateEditor(loadKg: 33, reps: 7)
store.apply(envelope(fixture(), revision: 101))
assert(store.loadKg == 33 && store.reps == 7, "Incoming snapshot must preserve editor draft")
assert(store.currentSet?.durationSeconds == nil, "Weight draft merge must not invent a timed prescription")
assert(store.snapshot!.exercises[0].sets[0].isCompleted, "Pending completion must replay")
let restored = WorkoutCoordinator()
assert(restored.snapshot != nil && restored.revision == 101, "Snapshot and revision must restore together")
restored.apply(envelope(restored.snapshot!, revision: 101))
assert(restored.snapshot != nil, "Equal cached revision must remain usable")
store.selectExercise("b")
store.completeCurrentSet()
store.showNextExercise()
assert(store.selectedExercise?.id == "a" && store.snapshot?.status == .active, "Next exercise must wrap to earlier unfinished work")
store.reopenSet("a1")
assert(store.currentSet?.id == "a1" && store.snapshot?.rest == nil)
store.snapshot?.weightUnit = "lbs"
store.updateDisplayedLoad(100)
assert(abs(store.loadKg - 45.359237) < 0.001, "Pounds editor must store kilograms")
store.finishWorkout()
assert(store.snapshot?.status == .completed && store.snapshot?.finishedAt != nil)
print("Watch coordinator: offline rest, draft merge, recovery, navigation, correction, units and finish checks passed")
'''
source += f'\nUserDefaults.standard.removePersistentDomain(forName: "{domain}")\n'
result = subprocess.run(["swift", "-"], input=source, text=True)
raise SystemExit(result.returncode)
