import Foundation
import Observation

@MainActor
@Observable
final class WorkoutCoordinator {
    enum Screen {
        case exerciseList
        case activeSet
        case rest
        case heartRate
        case exerciseComplete
    }

    struct RestTimerTransition {
        let shouldPlayWarning: Bool
        let shouldPlayCompletion: Bool
    }

    var snapshot: WatchWorkoutSnapshot?
    private(set) var revision: Int64
    private(set) var watchSettings: WatchSettingsSnapshot
    private(set) var settingsRevision: Int64
    var screen: Screen = .exerciseList
    var loadKg = 0.0
    var reps = 0
    var heartRateAtLastSet: Int?

    let connectivity = WatchConnectivityClient()
    let health = HealthKitClient()

    private var healthOwnershipSentForWorkoutID: String?
    private let revisionDefaultsKey = "SweatyWatch.lastAppliedRevision"
    private var restAlertStates: [String: RestAlertState] = [:]
    private var automaticallyOpenedRestIDs = Set<String>()
    private var observedRestID: String?
    private var observedRestRemaining: Int?

    private struct RestAlertState {
        var warningDelivered = false
        var completionDelivered = false
    }

    var selectedExercise: WatchExercise? {
        guard let snapshot else { return nil }
        let selectedID = snapshot.selectedExerciseId
        return snapshot.exercises.first(where: { $0.id == selectedID })
            ?? snapshot.exercises.first(where: { exercise in
                exercise.sets.contains(where: { !$0.isCompleted })
            })
            ?? snapshot.exercises.last
    }

    var currentSet: WatchSet? {
        selectedExercise?.sets.first(where: { !$0.isCompleted })
            ?? selectedExercise?.sets.last
    }

    var completedSetCount: Int {
        snapshot?.exercises.flatMap(\.sets).filter(\.isCompleted).count ?? 0
    }

    var totalSetCount: Int {
        snapshot?.exercises.flatMap(\.sets).count ?? 0
    }

    private(set) var currentRestRemaining = 0

    init() {
        let storedRevision =
            (UserDefaults.standard.object(forKey: revisionDefaultsKey) as? NSNumber)?
            .int64Value ?? 0
        revision = max(0, storedRevision)
        watchSettings = WatchSettingsSnapshot.load()
        settingsRevision = WatchSettingsSnapshot.loadRevision()
        connectivity.onEnvelope = { [weak self] envelope in
            self?.apply(envelope)
        }
        connectivity.onSettings = { [weak self] envelope in
            self?.apply(envelope)
        }
    }

    func start() {
        connectivity.activate()
    }

    func waitForPendingConnectivityContent() async {
        await connectivity.waitForPendingContent()
    }

    func apply(_ envelope: WatchSyncEnvelope) {
        if let settings = envelope.settings,
            let incomingSettingsRevision = envelope.settingsRevision
        {
            applySettings(settings, revision: incomingSettingsRevision)
        }

        connectivity.acknowledge(envelope.acknowledgedCommandIDs)
        guard envelope.revision > revision else { return }

        let previousWorkoutID = snapshot?.workoutId
        revision = envelope.revision
        UserDefaults.standard.set(revision, forKey: revisionDefaultsKey)
        snapshot = envelope.snapshot
        currentRestRemaining = envelope.snapshot.rest?.remainingSeconds() ?? 0

        if previousWorkoutID != envelope.snapshot.workoutId {
            screen = envelope.snapshot.status == .active ? .exerciseList : .exerciseList
            heartRateAtLastSet = nil
        } else if envelope.snapshot.rest != nil,
            screen == .activeSet,
            watchSettings.autoShowRestTimer
        {
            screen = .rest
        }

        seedEditor()
        manageHealthWorkout()
    }

    /// Apply a settings-only message without touching workout state, screen,
    /// HealthKit ownership, or the command outbox.
    func apply(_ envelope: WatchSettingsEnvelope) {
        applySettings(envelope.settings, revision: envelope.settingsRevision)
    }

    private func applySettings(
        _ settings: WatchSettingsSnapshot,
        revision incomingRevision: Int64
    ) {
        guard incomingRevision > settingsRevision else { return }
        let previousWarningSeconds = watchSettings.restWarningSeconds
        watchSettings = settings
        settingsRevision = incomingRevision
        settings.persist()
        UserDefaults.standard.set(
            incomingRevision,
            forKey: WatchSettingsSnapshot.revisionKey
        )

        // A newly raised threshold must not produce a catch-up tap for a
        // timer that was already below it when the preference changed. The
        // next rest cycle starts with a fresh alert state.
        if previousWarningSeconds != settings.restWarningSeconds,
            settings.restWarningSeconds > 0,
            let rest = snapshot?.rest
        {
            let remaining = rest.remainingSeconds()
            currentRestRemaining = remaining
            if remaining <= settings.restWarningSeconds {
                var state = restAlertStates[rest.id] ?? RestAlertState()
                state.warningDelivered = true
                restAlertStates[rest.id] = state
            }
        }
    }

    func selectExercise(_ exerciseID: String) {
        guard var snapshot, snapshot.status == .active else { return }
        snapshot.selectedExerciseId = exerciseID
        self.snapshot = snapshot
        screen = .activeSet
        seedEditor()
        send(.selectExercise, payload: ["exerciseId": exerciseID])
    }

    func updateEditor(loadKg: Double, reps: Int) {
        self.loadKg = loadKg
        self.reps = reps
        guard let exercise = selectedExercise, let set = currentSet else { return }
        send(
            .updateSet,
            payload: [
                "exerciseId": exercise.id,
                "setId": set.id,
                "loadKg": loadKg,
                "reps": reps,
            ]
        )
    }

    func completeCurrentSet() {
        guard let exercise = selectedExercise, let set = currentSet else { return }
        heartRateAtLastSet = health.heartRate
        optimisticallyComplete(exerciseID: exercise.id, setID: set.id)
        send(
            .completeSet,
            payload: [
                "exerciseId": exercise.id,
                "setId": set.id,
                "loadKg": loadKg,
                "reps": reps,
                "completedAt": ISO8601DateFormatter().string(from: .now),
            ]
        )
        HapticsClient.setCompleted(
            enabled: watchSettings.setCompletionHapticsEnabled
        )

        if selectedExercise?.sets.allSatisfy(\.isCompleted) == true {
            screen = .exerciseComplete
        } else if watchSettings.autoShowRestTimer {
            screen = .rest
        } else {
            // Keep the set logger visible when the user prefers a compact
            // running-rest affordance instead of automatic navigation.
            screen = .activeSet
        }
    }

    func adjustRest(by seconds: Int) {
        guard let rest = snapshot?.rest else { return }
        send(
            .adjustRest,
            payload: ["deltaSeconds": seconds, "restId": rest.id]
        )
    }

    func pauseRest() {
        guard let rest = snapshot?.rest else { return }
        send(.pauseRest, payload: ["restId": rest.id])
    }

    func resumeRest() {
        guard let rest = snapshot?.rest else { return }
        send(.resumeRest, payload: ["restId": rest.id])
    }

    func skipRest() {
        guard let rest = snapshot?.rest else { return }
        send(.skipRest, payload: ["restId": rest.id])
        if var snapshot {
            snapshot.rest = nil
            self.snapshot = snapshot
        }
        currentRestRemaining = 0
        observedRestID = nil
        observedRestRemaining = nil
        screen = .activeSet
    }

    /// Clear a rest automatically at zero at most once for its stable ID.
    /// Manual skip remains available through `skipRest()` and uses the same
    /// stable ID payload path.
    func openNextSetIfNeeded(restID: String) {
        guard snapshot?.rest?.id == restID,
            !automaticallyOpenedRestIDs.contains(restID)
        else { return }
        automaticallyOpenedRestIDs.insert(restID)
        skipRest()
    }

    /// Track haptic delivery against a stable rest ID rather than a SwiftUI
    /// view mount. A paused timer never advances alert state, and changing a
    /// warning threshold below the current remaining value cannot cause a
    /// catch-up warning because the crossing condition still requires the
    /// previous value to be above the new threshold.
    func restTimerTransition(
        restID: String,
        previousRemaining: Int,
        remaining: Int,
        isPaused: Bool
    ) -> RestTimerTransition {
        guard !isPaused else {
            return RestTimerTransition(
                shouldPlayWarning: false,
                shouldPlayCompletion: false
            )
        }

        var state = restAlertStates[restID] ?? RestAlertState()
        var shouldPlayWarning = false
        var shouldPlayCompletion = false
        let warningSeconds = watchSettings.restWarningSeconds
        if !state.warningDelivered,
            warningSeconds > 0,
            previousRemaining > warningSeconds,
            remaining > 0,
            remaining <= warningSeconds
        {
            state.warningDelivered = true
            shouldPlayWarning = true
        }
        if !state.completionDelivered,
            previousRemaining > 0,
            remaining <= 0
        {
            state.completionDelivered = true
            shouldPlayCompletion = true
        }
        restAlertStates[restID] = state
        return RestTimerTransition(
            shouldPlayWarning: shouldPlayWarning,
            shouldPlayCompletion: shouldPlayCompletion
        )
    }

    /// Observe the absolute-date rest timer independently from whichever
    /// workout screen is currently mounted. This is called by an always-live
    /// root monitor, so app haptics and automatic next-set behavior continue
    /// when the compact rest affordance is shown instead of RestTimerView.
    func observeRest(at date: Date = .now) {
        guard let rest = snapshot?.rest else {
            currentRestRemaining = 0
            observedRestID = nil
            observedRestRemaining = nil
            return
        }

        let remaining = rest.remainingSeconds(at: date)
        currentRestRemaining = remaining

        guard observedRestID == rest.id else {
            observedRestID = rest.id
            observedRestRemaining = remaining
            return
        }

        let previousRemaining = observedRestRemaining ?? remaining
        observedRestRemaining = remaining
        let transition = restTimerTransition(
            restID: rest.id,
            previousRemaining: previousRemaining,
            remaining: remaining,
            isPaused: rest.isPaused
        )
        if transition.shouldPlayWarning {
            HapticsClient.restTimerWarning(
                enabled: watchSettings.restWarningSeconds > 0
            )
        }
        if transition.shouldPlayCompletion {
            HapticsClient.restTimerComplete(
                enabled: watchSettings.restEndHapticsEnabled
            )
            if watchSettings.restCompletionBehavior == .openNextSet {
                openNextSetIfNeeded(restID: rest.id)
            }
        }
    }

    func finishWorkout() {
        Task {
            let healthWorkoutUUID = await health.endWorkout()
            send(
                .finishWorkout,
                payload: healthWorkoutUUID.map {
                    ["healthWorkoutUUID": $0.uuidString]
                } ?? [:]
            )
        }
    }

    func showNextExercise() {
        guard let snapshot, let selectedExercise,
            let index = snapshot.exercises.firstIndex(where: {
                $0.id == selectedExercise.id
            })
        else {
            screen = .exerciseList
            return
        }
        let next = snapshot.exercises.dropFirst(index + 1).first(where: {
            $0.sets.contains(where: { !$0.isCompleted })
        })
        if let next {
            selectExercise(next.id)
        } else {
            finishWorkout()
        }
    }

    private func seedEditor() {
        guard let set = currentSet else { return }
        loadKg = set.actualLoadKg ?? set.targetLoadKg ?? 0
        reps = Int(set.actualReps ?? set.targetReps ?? 0)
    }

    private func optimisticallyComplete(exerciseID: String, setID: String) {
        guard var snapshot,
            let exerciseIndex = snapshot.exercises.firstIndex(where: {
                $0.id == exerciseID
            }),
            let setIndex = snapshot.exercises[exerciseIndex].sets.firstIndex(where: {
                $0.id == setID
            })
        else { return }
        snapshot.exercises[exerciseIndex].sets[setIndex].actualLoadKg = loadKg
        snapshot.exercises[exerciseIndex].sets[setIndex].actualReps = Double(reps)
        snapshot.exercises[exerciseIndex].sets[setIndex].isCompleted = true
        self.snapshot = snapshot
    }

    private func manageHealthWorkout() {
        guard let snapshot else { return }
        if snapshot.status != .active {
            let terminalWorkoutID = snapshot.workoutId
            let shouldClearCancelledSnapshot = snapshot.status == .cancelled
            Task {
                _ = await health.endWorkout()
                if shouldClearCancelledSnapshot,
                    self.snapshot?.workoutId == terminalWorkoutID,
                    self.snapshot?.status == .cancelled
                {
                    self.snapshot = nil
                }
            }
            return
        }
        guard healthOwnershipSentForWorkoutID != snapshot.workoutId else { return }
        let workoutID = snapshot.workoutId
        Task {
            if await health.startWorkout(at: snapshot.startedAt) {
                guard self.snapshot?.workoutId == workoutID,
                    self.snapshot?.status == .active
                else {
                    _ = await health.endWorkout()
                    return
                }
                healthOwnershipSentForWorkoutID = workoutID
                send(.healthWorkoutStarted)
            }
        }
    }

    private func send(_ type: WatchCommand.CommandType, payload: [String: Any] = [:]) {
        guard let snapshot,
            JSONSerialization.isValidJSONObject(payload),
            let data = try? JSONSerialization.data(withJSONObject: payload),
            let payloadString = String(data: data, encoding: .utf8)
        else { return }
        var correlatedPayload = payload
        correlatedPayload["workoutId"] = snapshot.workoutId
        guard
            let correlatedData = try? JSONSerialization.data(
                withJSONObject: correlatedPayload
            ), let correlatedString = String(data: correlatedData, encoding: .utf8)
        else { return }

        let command = WatchCommand(
            protocolVersion: watchSyncProtocolVersion,
            commandID: UUID().uuidString,
            baseRevision: revision,
            sentAt: ISO8601DateFormatter().string(from: .now),
            type: type,
            payload: correlatedString.isEmpty ? payloadString : correlatedString
        )
        connectivity.enqueue(command)
    }
}
