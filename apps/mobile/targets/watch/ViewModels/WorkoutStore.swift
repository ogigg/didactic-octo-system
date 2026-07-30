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

    var snapshot: WatchWorkoutSnapshot?
    private(set) var revision: Int64
    var screen: Screen = .exerciseList
    var loadKg = 0.0
    var reps = 0
    var heartRateAtLastSet: Int?

    let connectivity = WatchConnectivityClient()
    let health = HealthKitClient()

    private var healthOwnershipSentForWorkoutID: String?
    private let revisionDefaultsKey = "SweatyWatch.lastAppliedRevision"

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

    init() {
        revision =
            (UserDefaults.standard.object(forKey: revisionDefaultsKey) as? NSNumber)?
            .int64Value ?? 0
        connectivity.onEnvelope = { [weak self] envelope in
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
        connectivity.acknowledge(envelope.acknowledgedCommandIDs)
        guard envelope.revision > revision else { return }

        let previousWorkoutID = snapshot?.workoutId
        revision = envelope.revision
        UserDefaults.standard.set(revision, forKey: revisionDefaultsKey)
        snapshot = envelope.snapshot

        if previousWorkoutID != envelope.snapshot.workoutId {
            screen = envelope.snapshot.status == .active ? .exerciseList : .exerciseList
            heartRateAtLastSet = nil
        } else if envelope.snapshot.rest != nil, screen == .activeSet {
            screen = .rest
        }

        seedEditor()
        manageHealthWorkout()
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
        HapticsClient.setCompleted()

        if selectedExercise?.sets.allSatisfy(\.isCompleted) == true {
            screen = .exerciseComplete
        } else {
            screen = .rest
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
        screen = .activeSet
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
