import Foundation
import Observation
import UserNotifications

@MainActor
@Observable
final class WorkoutCoordinator {
    enum Screen { case exerciseList, activeSet, rest, heartRate, exerciseComplete, details }

    var snapshot: WatchWorkoutSnapshot?
    private(set) var revision: Int64 = 0
    var screen: Screen = .exerciseList
    var returnScreen: Screen = .exerciseList
    private var navigationHistory: [Screen] = []
    var loadKg = 0.0
    var reps = 0
    var durationSeconds = 30
    var heartRateAtLastSet: Int?
    var isFinishing = false
    var healthSaveFailed = false
    var timedSetEnd: Date?
    var now = Date.now
    /// Phone-owned preferences, persisted on the Watch with their own revision.
    private(set) var watchSettings = WatchSettingsSnapshot.load()
    private(set) var settingsRevision = WatchSettingsSnapshot.loadRevision()

    let connectivity = WatchConnectivityClient()
    let health = HealthKitClient()
    private var editedSetID: String?
    private var tickTask: Task<Void, Never>?
    private var healthTask: Task<Void, Never>?
    private var healthTaskID = UUID()
    private var lastAlertedRestID: String?
    private var observedRestIDs = Set<String>()
    private var warnedRestIDs = Set<String>()
    private var autoOpenedRestIDs = Set<String>()
    private var lastAlertedTimedEnd: Date?
    private var lastHealthAttempt: Date?
    private var handledTerminalWorkoutIDs = Set<String>()
    private var scheduledRest: RestTimerState?
    private var scheduledTimedEnd: Date?
    private let cacheKey = "SweatyWatch.workoutCache"
    private let timerKey = "SweatyWatch.timedSetEnd"

    var isPreview: Bool {
        #if DEBUG
        ProcessInfo.processInfo.arguments.contains("--watch-preview")
        #else
        false
        #endif
    }

    private struct Cache: Codable { var revision: Int64; var snapshot: WatchWorkoutSnapshot; var editedSetID: String? }

    var selectedExercise: WatchExercise? {
        guard let snapshot else { return nil }
        return snapshot.exercises.first { $0.id == snapshot.selectedExerciseId }
            ?? snapshot.exercises.first { $0.sets.contains { !$0.isCompleted } }
            ?? snapshot.exercises.last
    }
    var currentSet: WatchSet? { selectedExercise?.sets.first { !$0.isCompleted } }
    var completedSetCount: Int { snapshot?.exercises.flatMap(\.sets).filter(\.isCompleted).count ?? 0 }
    var totalSetCount: Int { snapshot?.exercises.flatMap(\.sets).count ?? 0 }
    var hasNextExercise: Bool { snapshot?.exercises.contains { $0.sets.contains { !$0.isCompleted } } ?? false }
    var weightUnit: String { snapshot?.weightUnit == "lbs" ? "lbs" : "kg" }
    var displayedLoad: Double { weightUnit == "lbs" ? loadKg * 2.2046226218 : loadKg }
    var timedSetRemaining: Int { max(0, Int((timedSetEnd?.timeIntervalSince(now) ?? Double(durationSeconds)).rounded(.up))) }
    var pendingChanges: Bool { !connectivity.outbox.isEmpty || editedSetID != nil }

    init() {
        var restoredDraftID: String?
        if let data = UserDefaults.standard.data(forKey: cacheKey),
           let cache = try? JSONDecoder().decode(Cache.self, from: data) {
            revision = cache.revision
            snapshot = cache.snapshot
            restoredDraftID = cache.editedSetID
        }
        let draftExerciseID = selectedExercise?.id
        let restoredDraft = selectedExercise?.sets.first { $0.id == restoredDraftID }
        for command in connectivity.outbox where command.decodedPayload["workoutId"] as? String == snapshot?.workoutId {
            applyLocally(command.type, payload: command.decodedPayload)
        }
        if let draftExerciseID, let restoredDraft, !restoredDraft.isCompleted {
            editSet(exerciseID: draftExerciseID, setID: restoredDraft.id) {
                if !$0.isCompleted { $0 = restoredDraft }
            }
        }
        timedSetEnd = UserDefaults.standard.object(forKey: timerKey) as? Date
        connectivity.onEnvelope = { [weak self] in self?.apply($0) }
        connectivity.onSettings = { [weak self] in self?.apply($0) }
        health.onFailure = { [weak self] _ in
            guard let self else { return }
            self.healthSaveFailed = true
            if let id = self.health.activeWorkoutID { self.send(.healthWorkoutFailed, workoutID: id) }
        }
        #if DEBUG
        if isPreview { configurePreview() }
        #endif
        seedEditor()
        if !isPreview, currentSet?.id == restoredDraftID { editedSetID = restoredDraftID }
    }

    func start() {
        if isPreview { return }
        connectivity.activate()
        flushSavedHealthReceipt()
        manageHealthWorkout()
        if tickTask == nil {
            tickTask = Task { [weak self] in
                while !Task.isCancelled {
                    guard let self else { return }
                    self.now = .now
                    self.observeRest()
                    if let end = self.timedSetEnd, end <= self.now, self.lastAlertedTimedEnd != end {
                        self.lastAlertedTimedEnd = end
                        HapticsClient.restTimerComplete()
                    }
                    try? await Task.sleep(for: .seconds(1))
                }
            }
        }
        scheduleRestAlert()
        scheduleTimedAlert()
    }

    func waitForPendingConnectivityContent() async { await connectivity.waitForPendingContent() }

    /// Rest alerts and the automatic zero behavior run from the root ticker,
    /// so they keep working when the user is not on the rest screen. Each
    /// alert fires at most once per stable rest ID.
    private func observeRest() {
        guard let rest = snapshot?.rest, !rest.isPaused else { return }
        let remaining = rest.remainingSeconds()
        let warningSeconds = watchSettings.restWarningSeconds
        if !observedRestIDs.contains(rest.id) {
            observedRestIDs.insert(rest.id)
            // A rest that starts at or below the threshold gets no catch-up warning.
            if remaining <= warningSeconds { warnedRestIDs.insert(rest.id) }
        }
        if warningSeconds > 0, remaining > 0, remaining <= warningSeconds,
           !warnedRestIDs.contains(rest.id) {
            warnedRestIDs.insert(rest.id)
            HapticsClient.restTimerWarning()
        }
        guard remaining == 0, lastAlertedRestID != rest.id else { return }
        lastAlertedRestID = rest.id
        HapticsClient.restTimerComplete(enabled: watchSettings.restEndHapticsEnabled)
        if watchSettings.restCompletionBehavior == .openNextSet,
           !autoOpenedRestIDs.contains(rest.id) {
            autoOpenedRestIDs.insert(rest.id)
            skipRest()
        }
    }

    /// Settings-only message: never touches the workout, screen or outbox.
    func apply(_ envelope: WatchSettingsEnvelope) {
        applySettings(envelope.settings, revision: envelope.settingsRevision)
    }

    private func applySettings(_ settings: WatchSettingsSnapshot, revision incomingRevision: Int64) {
        guard incomingRevision > settingsRevision else { return }
        let previousWarningSeconds = watchSettings.restWarningSeconds
        watchSettings = settings
        settingsRevision = incomingRevision
        settings.persist()
        UserDefaults.standard.set(incomingRevision, forKey: WatchSettingsSnapshot.revisionKey)
        // A raised threshold must not produce a catch-up warning for a timer
        // that was already below it when the preference changed.
        if previousWarningSeconds != settings.restWarningSeconds, let rest = snapshot?.rest,
           rest.remainingSeconds() <= settings.restWarningSeconds {
            warnedRestIDs.insert(rest.id)
        }
    }

    func apply(_ envelope: WatchSyncEnvelope) {
        if let settings = envelope.settings, let settingsRevision = envelope.settingsRevision {
            applySettings(settings, revision: settingsRevision)
        }
        guard envelope.revision >= revision else { return }
        // Commit a draft before a phone-driven selection change can move its editor.
        if let editedSetID, let exercise = selectedExercise,
           envelope.snapshot.workoutId == snapshot?.workoutId,
           envelope.snapshot.selectedExerciseId != snapshot?.selectedExerciseId ||
           envelope.snapshot.exercises.first(where: { $0.id == exercise.id })?.sets.first(where: { !$0.isCompleted })?.id != editedSetID {
            saveEditor()
        }
        let oldWorkout = snapshot?.workoutId
        let draftExercise = selectedExercise?.id
        let draftSet = editedSetID
        let draftLoad = loadKg, draftReps = reps, draftDuration = durationSeconds
        revision = envelope.revision
        snapshot = envelope.snapshot
        // Reapply unacknowledged local actions over the canonical phone snapshot.
        for command in connectivity.outbox where command.decodedPayload["workoutId"] as? String == snapshot?.workoutId {
            applyLocally(command.type, payload: command.decodedPayload)
        }
        if snapshot?.status != .active { timedSetEnd = nil; editedSetID = nil }
        if oldWorkout != snapshot?.workoutId {
            editedSetID = nil
            timedSetEnd = nil
            heartRateAtLastSet = nil
            lastHealthAttempt = nil
            screen = .exerciseList
        } else if let draftSet, let draftExercise, snapshot?.status == .active {
            let isTimed = snapshot?.exercises.first(where: { $0.id == draftExercise })?.exerciseType == .time
            editSet(exerciseID: draftExercise, setID: draftSet) { set in
                guard !set.isCompleted else { return }
                set.actualLoadKg = draftLoad
                set.actualReps = Double(draftReps)
                if isTimed { set.durationSeconds = draftDuration }
            }
        }
        if screen == .rest, snapshot?.rest == nil { screen = currentSet == nil ? .exerciseComplete : .activeSet }
        if screen == .activeSet, currentSet == nil { screen = .exerciseComplete }
        if draftSet == nil || currentSet?.id != draftSet { seedEditor() }
        persist()
        scheduleRestAlert()
        manageHealthWorkout()
    }

    func selectExercise(_ exerciseID: String) {
        guard snapshot?.status == .active else { return }
        saveEditor()
        timedSetEnd = nil
        perform(.selectExercise, payload: ["exerciseId": exerciseID])
        screen = currentSet == nil ? .exerciseComplete : .activeSet
        seedEditor()
    }

    func navigate(_ destination: Screen) {
        guard destination != screen else { return }
        saveEditor()
        if destination == .heartRate || destination == .details {
            navigationHistory.append(screen)
            returnScreen = screen
        } else { navigationHistory.removeAll() }
        if destination == .rest, snapshot?.rest == nil {
            screen = currentSet == nil ? .exerciseComplete : .activeSet
        } else if destination == .activeSet, currentSet == nil {
            screen = .exerciseComplete
        } else { screen = destination }
    }

    func goBack() {
        saveEditor()
        let destination = navigationHistory.popLast() ?? .exerciseList
        if destination == .rest, snapshot?.rest == nil { screen = currentSet == nil ? .exerciseComplete : .activeSet }
        else if destination == .activeSet, currentSet == nil { screen = .exerciseComplete }
        else { screen = destination }
        returnScreen = navigationHistory.last ?? .exerciseList
    }

    func updateEditor(loadKg: Double, reps: Int) {
        self.loadKg = min(1500, max(0, loadKg))
        self.reps = min(1000, max(0, reps))
        storeEditorDraft()
    }

    func updateDuration(_ value: Int) {
        durationSeconds = min(3600, max(1, value))
        timedSetEnd = nil
        storeEditorDraft()
    }

    func updateDisplayedLoad(_ value: Double) {
        updateEditor(loadKg: weightUnit == "lbs" ? value / 2.2046226218 : value, reps: reps)
    }

    private func storeEditorDraft() {
        guard let exercise = selectedExercise, let set = currentSet else { return }
        editedSetID = set.id
        editSet(exerciseID: exercise.id, setID: set.id) {
            $0.actualLoadKg = loadKg
            $0.actualReps = Double(reps)
            if exercise.exerciseType == .time { $0.durationSeconds = durationSeconds }
        }
        persist()
    }

    func saveEditor() {
        guard let editedSetID, let exercise = selectedExercise,
              let set = exercise.sets.first(where: { $0.id == editedSetID }), !set.isCompleted else { return }
        send(.updateSet, payload: editorPayload(exercise: exercise, set: set))
        self.editedSetID = nil
        persist()
    }

    func startTimedSet() {
        timedSetEnd = .now.addingTimeInterval(Double(durationSeconds))
        persist()
    }

    func completeCurrentSet() {
        guard snapshot?.status == .active, let exercise = selectedExercise, let set = currentSet else { return }
        heartRateAtLastSet = health.heartRate
        var payload = editorPayload(exercise: exercise, set: set)
        if exercise.exerciseType == .time, let end = timedSetEnd {
            let elapsed = Double(durationSeconds) + Date.now.timeIntervalSince(end)
            payload["durationSeconds"] = max(1, min(durationSeconds, Int(elapsed.rounded())))
        }
        payload["completedAt"] = Self.iso(.now)
        payload["restId"] = UUID().uuidString
        editedSetID = nil
        timedSetEnd = nil
        perform(.completeSet, payload: payload)
        HapticsClient.setCompleted(enabled: watchSettings.setCompletionHapticsEnabled)
        // With auto-show off, the set logger stays visible and rest runs in the background.
        screen = currentSet == nil ? .exerciseComplete : (watchSettings.autoShowRestTimer ? .rest : .activeSet)
        seedEditor()
    }

    func setWarmupComplete(_ completed: Bool) {
        perform(.setWarmupComplete, payload: ["isCompleted": completed])
    }

    func reopenSet(_ setID: String) {
        guard snapshot?.status == .active, let exercise = selectedExercise else { return }
        perform(.reopenSet, payload: ["exerciseId": exercise.id, "setId": setID])
        screen = .activeSet
        seedEditor()
    }

    func adjustRest(by seconds: Int) {
        guard var rest = snapshot?.rest else { return }
        let remaining = max(0, rest.remainingSeconds() + seconds)
        rest.durationSeconds = max(1, rest.durationSeconds + seconds)
        if rest.isPaused { rest.pausedRemainingSeconds = Double(remaining) }
        else { rest.endDate = .now.addingTimeInterval(Double(remaining)) }
        updateRest(rest, type: .adjustRest, delta: seconds)
    }

    func pauseRest() {
        guard var rest = snapshot?.rest else { return }
        rest.pausedRemainingSeconds = Double(rest.remainingSeconds())
        rest.endDate = nil
        updateRest(rest, type: .pauseRest)
    }
    func resumeRest() {
        guard var rest = snapshot?.rest else { return }
        rest.endDate = .now.addingTimeInterval(Double(rest.remainingSeconds()))
        rest.pausedRemainingSeconds = nil
        updateRest(rest, type: .resumeRest)
    }
    func skipRest() {
        if let rest = snapshot?.rest { perform(.skipRest, payload: ["restId": rest.id]) }
        screen = currentSet == nil ? .exerciseComplete : .activeSet
    }

    func finishWorkout() {
        guard !isFinishing, snapshot?.status == .active else { return }
        saveEditor()
        let finishedAt = Date.now
        let workoutID = snapshot!.workoutId
        isFinishing = true
        handledTerminalWorkoutIDs.insert(workoutID)
        // Persist and queue completion immediately, independently of HealthKit saving.
        perform(.finishWorkout, payload: ["finishedAt": Self.iso(finishedAt)])
        if isPreview { isFinishing = false; return }
        let previousTask = healthTask
        let taskID = UUID()
        healthTaskID = taskID
        healthTask = Task {
            await previousTask?.value
            let uuid = await health.endWorkout(at: finishedAt, expectedWorkoutID: workoutID)
            guard healthTaskID == taskID else { return }
            healthSaveFailed = uuid == nil
            if uuid != nil { flushSavedHealthReceipt() }
            else { send(.healthWorkoutFailed, workoutID: workoutID) }
            isFinishing = false
            healthTask = nil
            manageHealthWorkout()
        }
    }

    func showNextExercise() {
        guard let snapshot else { return }
        let incomplete = snapshot.exercises.filter { $0.sets.contains { !$0.isCompleted } }
        if let next = incomplete.first(where: { $0.id != selectedExercise?.id }) ?? incomplete.first {
            selectExercise(next.id)
        } else { finishWorkout() }
    }

    private func editorPayload(exercise: WatchExercise, set: WatchSet) -> [String: Any] {
        var payload: [String: Any] = ["exerciseId": exercise.id, "setId": set.id]
        if exercise.exerciseType == .time { payload["durationSeconds"] = durationSeconds }
        else { payload["loadKg"] = loadKg; payload["reps"] = reps }
        return payload
    }

    private func seedEditor() {
        editedSetID = nil
        guard let set = currentSet else { return }
        loadKg = set.actualLoadKg ?? set.targetLoadKg ?? 0
        reps = Int(set.actualReps ?? set.targetReps ?? 0)
        durationSeconds = set.durationSeconds ?? 30
    }

    private func updateRest(_ rest: RestTimerState, type: WatchCommand.CommandType, delta: Int = 0) {
        var payload: [String: Any] = ["restId": rest.id, "exerciseId": rest.exerciseId,
            "durationSeconds": rest.durationSeconds, "deltaSeconds": delta]
        if let end = rest.endDate { payload["endDate"] = Self.iso(end) }
        if let paused = rest.pausedRemainingSeconds { payload["pausedRemainingSeconds"] = paused }
        perform(type, payload: payload)
    }

    private func perform(_ type: WatchCommand.CommandType, payload: [String: Any]) {
        // Queue before changing the cached projection, so relaunch can replay it.
        send(type, payload: payload)
        applyLocally(type, payload: payload)
        persist()
        scheduleRestAlert()
    }

    private func applyLocally(_ type: WatchCommand.CommandType, payload: [String: Any]) {
        switch type {
        case .setWarmupComplete:
            if let completed = payload["isCompleted"] as? Bool { snapshot?.warmup?.isCompleted = completed }
        case .selectExercise:
            snapshot?.selectedExerciseId = payload["exerciseId"] as? String
        case .updateSet, .completeSet, .reopenSet:
            guard let exerciseID = payload["exerciseId"] as? String,
                  let setID = payload["setId"] as? String else { return }
            editSet(exerciseID: exerciseID, setID: setID) {
                if let load = payload["loadKg"] as? Double { $0.actualLoadKg = load }
                if let reps = payload["reps"] as? Int { $0.actualReps = Double(reps) }
                if let duration = payload["durationSeconds"] as? Int { $0.durationSeconds = duration }
                if type != .updateSet { $0.isCompleted = type == .completeSet }
            }
            if type == .completeSet, let exercise = snapshot?.exercises.first(where: { $0.id == exerciseID }),
               let restID = payload["restId"] as? String {
                let start = Self.date(payload["completedAt"]) ?? .now
                snapshot?.rest = RestTimerState(id: restID, exerciseId: exerciseID,
                    durationSeconds: exercise.restDurationSeconds,
                    endDate: start.addingTimeInterval(Double(exercise.restDurationSeconds)))
            } else if type == .reopenSet { snapshot?.rest = nil }
        case .adjustRest, .pauseRest, .resumeRest:
            guard snapshot?.rest?.id == payload["restId"] as? String else { return }
            if let duration = payload["durationSeconds"] as? Int { snapshot?.rest?.durationSeconds = duration }
            snapshot?.rest?.endDate = Self.date(payload["endDate"])
            snapshot?.rest?.pausedRemainingSeconds = payload["pausedRemainingSeconds"] as? Double
        case .skipRest:
            if snapshot?.rest?.id == payload["restId"] as? String { snapshot?.rest = nil }
        case .finishWorkout:
            snapshot?.status = .completed
            snapshot?.finishedAt = Self.date(payload["finishedAt"]) ?? .now
            snapshot?.rest = nil
        default: break
        }
    }

    private func editSet(exerciseID: String, setID: String, edit: (inout WatchSet) -> Void) {
        guard let exerciseIndex = snapshot?.exercises.firstIndex(where: { $0.id == exerciseID }),
              let setIndex = snapshot?.exercises[exerciseIndex].sets.firstIndex(where: { $0.id == setID }) else { return }
        edit(&snapshot!.exercises[exerciseIndex].sets[setIndex])
    }

    func retryHealthWorkout() {
        lastHealthAttempt = nil
        healthSaveFailed = false
        manageHealthWorkout()
    }

    private func manageHealthWorkout() {
        guard !isPreview, let snapshot, healthTask == nil else { return }
        let taskID = UUID()
        healthTaskID = taskID
        if snapshot.status == .active {
            guard health.activeWorkoutID != snapshot.workoutId || !health.isSessionActive else { return }
            guard lastHealthAttempt == nil || Date.now.timeIntervalSince(lastHealthAttempt!) > 30 else { return }
            lastHealthAttempt = .now
            healthTask = Task {
                if let previousID = health.activeWorkoutID, previousID != snapshot.workoutId {
                    send(.healthWorkoutFailed, workoutID: previousID)
                }
                let started = await health.startWorkout(workoutID: snapshot.workoutId, at: snapshot.startedAt)
                guard healthTaskID == taskID else { return }
                if started { healthSaveFailed = false; send(.healthWorkoutStarted, workoutID: snapshot.workoutId) }
                else { healthSaveFailed = true; send(.healthWorkoutFailed, workoutID: snapshot.workoutId) }
                healthTask = nil
                manageHealthWorkout()
            }
        } else if !handledTerminalWorkoutIDs.contains(snapshot.workoutId) {
            handledTerminalWorkoutIDs.insert(snapshot.workoutId)
            healthTask = Task {
                _ = await health.recoverActiveWorkoutSession()
                guard health.activeWorkoutID == snapshot.workoutId else {
                    if let previousID = health.activeWorkoutID {
                        send(.healthWorkoutFailed, workoutID: previousID)
                        _ = await health.endWorkout(discard: true, expectedWorkoutID: previousID)
                    }
                    guard healthTaskID == taskID else { return }
                    handledTerminalWorkoutIDs.remove(snapshot.workoutId)
                    healthTask = nil
                    return
                }
                let uuid = await health.endWorkout(at: snapshot.finishedAt ?? .now, discard: snapshot.status == .cancelled, expectedWorkoutID: snapshot.workoutId)
                guard healthTaskID == taskID else { return }
                if snapshot.status == .completed {
                    if uuid != nil { flushSavedHealthReceipt() }
                    else { send(.healthWorkoutFailed, workoutID: snapshot.workoutId) }
                }
                healthTask = nil
                manageHealthWorkout()
            }
        }
    }

    private func flushSavedHealthReceipt() {
        guard let receipt = health.pendingSavedWorkout else { return }
        send(.healthWorkoutSaved, payload: ["healthWorkoutUUID": receipt.healthWorkoutUUID.uuidString], workoutID: receipt.workoutID)
        handledTerminalWorkoutIDs.insert(receipt.workoutID)
        health.acknowledgeSavedWorkout(workoutID: receipt.workoutID)
    }

    private func scheduleRestAlert() {
        guard !isPreview else { return }
        let rest = snapshot?.rest
        guard rest != scheduledRest else { return }
        scheduledRest = rest
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["rest-complete"])
        guard let rest, !rest.isPaused, rest.remainingSeconds() > 0 else { return }
        Task {
            guard (try? await center.requestAuthorization(options: [.alert, .sound])) == true else { return }
            guard self.snapshot?.rest == rest else { return }
            let content = UNMutableNotificationContent()
            content.title = String(localized: "Rest complete")
            content.body = String(localized: "Ready for your next set")
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: Double(max(1, rest.remainingSeconds())), repeats: false)
            try? await center.add(UNNotificationRequest(identifier: "rest-complete", content: content, trigger: trigger))
        }
    }

    private func scheduleTimedAlert() {
        guard !isPreview, timedSetEnd != scheduledTimedEnd else { return }
        scheduledTimedEnd = timedSetEnd
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["timed-set-complete"])
        guard let end = timedSetEnd, end > .now else { return }
        Task {
            guard (try? await center.requestAuthorization(options: [.alert, .sound])) == true,
                  self.timedSetEnd == end else { return }
            let content = UNMutableNotificationContent()
            content.title = String(localized: "Timer complete")
            content.body = String(localized: "Log your set when ready")
            content.sound = .default
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, end.timeIntervalSinceNow), repeats: false)
            try? await center.add(UNNotificationRequest(identifier: "timed-set-complete", content: content, trigger: trigger))
        }
    }

    private func persist() {
        guard !isPreview, let snapshot, let data = try? JSONEncoder().encode(Cache(revision: revision, snapshot: snapshot, editedSetID: editedSetID)) else { return }
        scheduleTimedAlert()
        UserDefaults.standard.set(data, forKey: cacheKey)
        UserDefaults.standard.set(timedSetEnd, forKey: timerKey)
    }

    private func send(_ type: WatchCommand.CommandType, payload: [String: Any] = [:], workoutID: String? = nil) {
        guard !isPreview, let id = workoutID ?? snapshot?.workoutId else { return }
        var body = payload
        body["workoutId"] = id
        guard let data = try? JSONSerialization.data(withJSONObject: body),
              let json = String(data: data, encoding: .utf8) else { return }
        connectivity.enqueue(WatchCommand(protocolVersion: watchSyncProtocolVersion,
            commandID: UUID().uuidString, baseRevision: revision, sentAt: Self.iso(.now), type: type, payload: json))
    }

    static func iso(_ date: Date) -> String { ISO8601DateFormatter().string(from: date) }
    static func date(_ value: Any?) -> Date? {
        guard let string = value as? String else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: string) ?? ISO8601DateFormatter().date(from: string)
    }
}
