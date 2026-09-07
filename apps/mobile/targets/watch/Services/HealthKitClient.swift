import Foundation
import HealthKit
import Observation

@MainActor
@Observable
final class HealthKitClient: NSObject, HKWorkoutSessionDelegate,
    HKLiveWorkoutBuilderDelegate
{
    private enum SessionState {
        case idle
        case starting
        case active
        case ending
    }

    private struct ClientError: LocalizedError {
        let message: String

        var errorDescription: String? { message }
    }

    struct SavedWorkoutReceipt: Codable, Equatable {
        let workoutID: String
        let healthWorkoutUUID: UUID
    }

    private static let recoveryWorkoutIDKey = "SweatyWatch.healthRecoveryWorkoutID"
    private static let recoveryStartDateKey = "SweatyWatch.healthRecoveryStartDate"
    private static let pendingSavedWorkoutKey = "SweatyWatch.healthPendingSavedWorkout"
    private static let heartRateFreshnessInterval: TimeInterval = 15

    private let healthStore = HKHealthStore()
    private let defaults = UserDefaults.standard
    private var workoutSession: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var state = SessionState.idle
    private var startTask: Task<Bool, Never>?
    private var startTaskID: UUID?
    private var endTask: Task<UUID?, Never>?
    private var recoveryTask: Task<Bool, Never>?
    private var recoveryWorkoutID: String?
    private var recoveryStartDate: Date?
    private var latestHeartRate: Int?
    private var heartRateExpiryTask: Task<Void, Never>?

    private(set) var heartRateDate: Date?
    private(set) var activeWorkoutID: String?
    private(set) var pendingSavedWorkout: SavedWorkoutReceipt?
    var onFailure: ((Error) -> Void)?

    var heartRate: Int? {
        guard
            let latestHeartRate,
            let heartRateDate,
            Date.now.timeIntervalSince(heartRateDate)
                <= Self.heartRateFreshnessInterval
        else { return nil }
        return latestHeartRate
    }

    var isSessionActive: Bool {
        workoutSession != nil && state != .idle
    }

    override init() {
        recoveryWorkoutID = defaults.string(forKey: Self.recoveryWorkoutIDKey)
        recoveryStartDate = defaults.object(forKey: Self.recoveryStartDateKey) as? Date
        if let data = defaults.data(forKey: Self.pendingSavedWorkoutKey) {
            pendingSavedWorkout = try? JSONDecoder().decode(
                SavedWorkoutReceipt.self,
                from: data
            )
        }
        super.init()
    }

    func startWorkout(workoutID: String, at startDate: Date) async -> Bool {
        guard !workoutID.isEmpty else {
            reportFailure(ClientError(message: "HealthKit workout ID is empty."))
            return false
        }

        if let inFlightStart = startTask {
            let inFlightStartID = startTaskID
            let result = await inFlightStart.value
            // The task owner normally clears this after awaiting it. A waiter
            // may resume first, so clear the completed task before continuing.
            if startTaskID == inFlightStartID {
                startTask = nil
                startTaskID = nil
            }
            if activeWorkoutID == workoutID {
                return result
            }
        }
        if let recoveryTask {
            _ = await recoveryTask.value
        }
        if let endTask {
            _ = await endTask.value
        }

        if workoutSession == nil, recoveryWorkoutID != nil {
            _ = await recoverActiveWorkoutSession()
        }

        if let activeWorkoutID, activeWorkoutID != workoutID {
            _ = await performEnd(at: .now, discard: true)
        }
        guard state == .idle else { return activeWorkoutID == workoutID }

        let operationID = UUID()
        let task = Task { @MainActor [weak self] in
            await self?.performStart(workoutID: workoutID, at: startDate) ?? false
        }
        startTaskID = operationID
        startTask = task
        let result = await task.value
        if startTaskID == operationID {
            startTask = nil
            startTaskID = nil
        }
        return result
    }

    func endWorkout(
        at endDate: Date = .now,
        discard: Bool = false,
        expectedWorkoutID: String? = nil
    ) async -> UUID? {
        if let endTask {
            if let expectedWorkoutID, activeWorkoutID != expectedWorkoutID {
                return nil
            }
            return await endTask.value
        }
        if let startTask {
            _ = await startTask.value
        }
        if let recoveryTask {
            _ = await recoveryTask.value
        }
        if workoutSession == nil, recoveryWorkoutID != nil {
            _ = await recoverActiveWorkoutSession()
        }
        if let expectedWorkoutID, activeWorkoutID != expectedWorkoutID {
            return nil
        }
        guard workoutSession != nil, state != .idle else { return nil }

        let task = Task { @MainActor [weak self] in
            await self?.performEnd(at: endDate, discard: discard)
        }
        endTask = task
        let result = await task.value
        endTask = nil
        return result
    }

    /// Re-attaches to a HealthKit workout after watchOS launches the app for
    /// active-workout recovery. The coordinator supplies the persisted app
    /// workout identity through `startWorkout` before a crash occurs.
    func recoverActiveWorkoutSession() async -> Bool {
        if let recoveryTask {
            return await recoveryTask.value
        }
        guard workoutSession == nil else { return isSessionActive }
        guard HKHealthStore.isHealthDataAvailable() else { return false }

        let task = Task { @MainActor [weak self] in
            await self?.performRecovery() ?? false
        }
        recoveryTask = task
        let result = await task.value
        recoveryTask = nil
        return result
    }

    private func performStart(workoutID: String, at startDate: Date) async -> Bool {
        guard HKHealthStore.isHealthDataAvailable(), state == .idle else {
            return activeWorkoutID == workoutID
        }
        state = .starting
        persistRecoveryIdentity(workoutID: workoutID, startDate: startDate)

        var startedSession: HKWorkoutSession?

        do {
            let workoutType = HKWorkoutType.workoutType()
            let heartRateType = HKQuantityType(.heartRate)
            try await healthStore.requestAuthorization(
                toShare: [workoutType],
                read: [heartRateType]
            )

            let configuration = HKWorkoutConfiguration()
            configuration.activityType = .traditionalStrengthTraining
            configuration.locationType = .indoor

            let session = try HKWorkoutSession(
                healthStore: healthStore,
                configuration: configuration
            )
            startedSession = session
            let builder = session.associatedWorkoutBuilder()
            configure(session: session, builder: builder, configuration: configuration)
            workoutSession = session
            self.builder = builder
            activeWorkoutID = workoutID
            session.startActivity(with: startDate)
            try await builder.beginCollection(at: startDate)
            guard workoutSession === session, state != .idle, state != .ending else {
                throw ClientError(message: "HealthKit workout session was lost while starting.")
            }
            state = .active
            return true
        } catch {
            startedSession?.end()
            self.builder?.discardWorkout()
            reportFailure(error)
            reset()
            return false
        }
    }

    private func performRecovery() async -> Bool {
        guard let recoveryWorkoutID else { return false }

        do {
            guard let session = try await healthStore.recoverActiveWorkoutSession()
            else {
                clearRecoveryIdentity()
                return false
            }
            guard session.state != .ended else {
                reportFailure(
                    ClientError(message: "Recovered HealthKit workout is already ended.")
                )
                reset()
                return false
            }

            let configuration = session.workoutConfiguration
            let builder = session.associatedWorkoutBuilder()
            configure(session: session, builder: builder, configuration: configuration)
            workoutSession = session
            self.builder = builder
            activeWorkoutID = recoveryWorkoutID
            state = .active
            persistRecoveryIdentity(
                workoutID: recoveryWorkoutID,
                startDate: session.startDate ?? recoveryStartDate ?? .now
            )
            return true
        } catch {
            reportFailure(error)
            reset(preservingRecoveryIdentity: true)
            return false
        }
    }

    private func performEnd(at endDate: Date, discard: Bool) async -> UUID? {
        guard let builder, let session = workoutSession, state != .idle else {
            return nil
        }
        state = .ending
        session.end()

        do {
            try await builder.endCollection(at: endDate)
            if discard {
                builder.discardWorkout()
                reset()
                return nil
            }

            guard let workout = try await builder.finishWorkout() else {
                throw ClientError(message: "HealthKit saved the workout without returning its UUID.")
            }
            let uuid = workout.uuid
            if let workoutID = activeWorkoutID {
                let receipt = SavedWorkoutReceipt(
                    workoutID: workoutID,
                    healthWorkoutUUID: uuid
                )
                pendingSavedWorkout = receipt
                if let data = try? JSONEncoder().encode(receipt) {
                    defaults.set(data, forKey: Self.pendingSavedWorkoutKey)
                }
            }
            reset()
            return uuid
        } catch {
            builder.discardWorkout()
            reportFailure(error)
            reset()
            return nil
        }
    }

    private func configure(
        session: HKWorkoutSession,
        builder: HKLiveWorkoutBuilder,
        configuration: HKWorkoutConfiguration
    ) {
        session.delegate = self
        builder.delegate = self
        if builder.dataSource == nil {
            builder.dataSource = HKLiveWorkoutDataSource(
                healthStore: healthStore,
                workoutConfiguration: configuration
            )
        }
    }

    nonisolated func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {
        Task { @MainActor [weak self, weak workoutSession] in
            guard
                let self,
                let currentSession = self.workoutSession,
                currentSession === workoutSession
            else { return }

            switch toState {
            case .running, .paused, .prepared:
                if self.state != .ending {
                    self.state = .active
                }
            case .ended, .stopped:
                guard self.state != .ending else { return }
                self.builder?.discardWorkout()
                self.reportFailure(
                    ClientError(message: "HealthKit workout session ended unexpectedly.")
                )
                self.reset()
            case .notStarted:
                break
            @unknown default:
                break
            }
        }
    }

    nonisolated func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didFailWithError error: Error
    ) {
        Task { @MainActor [weak self, weak workoutSession] in
            guard
                let self,
                let currentSession = self.workoutSession,
                currentSession === workoutSession,
                self.state != .ending
            else { return }
            self.builder?.discardWorkout()
            self.reportFailure(error)
            self.reset()
        }
    }

    nonisolated func workoutBuilderDidCollectEvent(
        _ workoutBuilder: HKLiveWorkoutBuilder
    ) {}

    nonisolated func workoutBuilder(
        _ workoutBuilder: HKLiveWorkoutBuilder,
        didCollectDataOf collectedTypes: Set<HKSampleType>
    ) {
        guard collectedTypes.contains(HKQuantityType(.heartRate)) else { return }
        Task { @MainActor [weak self, weak workoutBuilder] in
            guard
                let self,
                let workoutBuilder,
                let currentBuilder = self.builder,
                currentBuilder === workoutBuilder,
                let statistics = workoutBuilder.statistics(
                    for: HKQuantityType(.heartRate)
                ),
                let quantity = statistics.mostRecentQuantity(),
                let measuredDate = statistics.mostRecentQuantityDateInterval()?.end
            else { return }
            let unit = HKUnit.count().unitDivided(by: .minute())
            self.latestHeartRate = Int(quantity.doubleValue(for: unit).rounded())
            self.heartRateDate = measuredDate
            self.heartRateExpiryTask?.cancel()
            let expiryDate = measuredDate.addingTimeInterval(
                Self.heartRateFreshnessInterval
            )
            self.heartRateExpiryTask = Task { @MainActor [weak self] in
                let delay = expiryDate.timeIntervalSinceNow
                if delay > 0 {
                    try? await Task.sleep(for: .seconds(delay))
                }
                guard !Task.isCancelled, self?.heartRateDate == measuredDate else {
                    return
                }
                self?.latestHeartRate = nil
            }
        }
    }

    private func persistRecoveryIdentity(workoutID: String, startDate: Date) {
        recoveryWorkoutID = workoutID
        recoveryStartDate = startDate
        defaults.set(workoutID, forKey: Self.recoveryWorkoutIDKey)
        defaults.set(startDate, forKey: Self.recoveryStartDateKey)
    }

    private func clearRecoveryIdentity() {
        recoveryWorkoutID = nil
        recoveryStartDate = nil
        defaults.removeObject(forKey: Self.recoveryWorkoutIDKey)
        defaults.removeObject(forKey: Self.recoveryStartDateKey)
    }

    func acknowledgeSavedWorkout(workoutID: String) {
        guard pendingSavedWorkout?.workoutID == workoutID else { return }
        pendingSavedWorkout = nil
        defaults.removeObject(forKey: Self.pendingSavedWorkoutKey)
    }

    private func reportFailure(_ error: Error) {
        print("[SweatyWatch] HealthKit failure:", error)
        onFailure?(error)
    }

    private func reset(preservingRecoveryIdentity: Bool = false) {
        heartRateExpiryTask?.cancel()
        heartRateExpiryTask = nil
        workoutSession = nil
        builder = nil
        state = .idle
        activeWorkoutID = nil
        latestHeartRate = nil
        heartRateDate = nil
        if !preservingRecoveryIdentity {
            clearRecoveryIdentity()
        }
    }
}
