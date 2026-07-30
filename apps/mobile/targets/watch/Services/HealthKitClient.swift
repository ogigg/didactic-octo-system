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

    var heartRate: Int?
    var isSessionActive: Bool { state == .active }

    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var state = SessionState.idle
    private var startTask: Task<Bool, Never>?
    private var endTask: Task<UUID?, Never>?

    func startWorkout(at startDate: Date) async -> Bool {
        if let startTask {
            return await startTask.value
        }
        if let endTask {
            _ = await endTask.value
        }
        guard state == .idle else { return state == .active }

        let task = Task { @MainActor [weak self] in
            await self?.performStart(at: startDate) ?? false
        }
        startTask = task
        let result = await task.value
        startTask = nil
        return result
    }

    func endWorkout() async -> UUID? {
        if let endTask {
            return await endTask.value
        }
        if let startTask {
            _ = await startTask.value
        }
        guard state == .active else { return nil }

        let task = Task { @MainActor [weak self] in
            await self?.performEnd()
        }
        endTask = task
        let result = await task.value
        endTask = nil
        return result
    }

    private func performStart(at startDate: Date) async -> Bool {
        guard HKHealthStore.isHealthDataAvailable(), state == .idle else {
            return state == .active
        }
        state = .starting
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
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(
                healthStore: healthStore,
                workoutConfiguration: configuration
            )
            session.delegate = self
            builder.delegate = self
            workoutSession = session
            self.builder = builder
            session.startActivity(with: startDate)
            try await builder.beginCollection(at: startDate)
            state = .active
            return true
        } catch {
            print("[SweatyWatch] HealthKit start failed:", error)
            reset()
            return false
        }
    }

    private func performEnd() async -> UUID? {
        guard state == .active, let builder else { return nil }
        state = .ending
        workoutSession?.end()
        do {
            try await builder.endCollection(at: .now)
            let workout = try await builder.finishWorkout()
            reset()
            return workout?.uuid
        } catch {
            print("[SweatyWatch] HealthKit finish failed:", error)
            reset()
            return nil
        }
    }

    nonisolated func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {}

    nonisolated func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didFailWithError error: Error
    ) {
        Task { @MainActor in self.reset() }
    }

    nonisolated func workoutBuilderDidCollectEvent(
        _ workoutBuilder: HKLiveWorkoutBuilder
    ) {}

    nonisolated func workoutBuilder(
        _ workoutBuilder: HKLiveWorkoutBuilder,
        didCollectDataOf collectedTypes: Set<HKSampleType>
    ) {
        guard collectedTypes.contains(HKQuantityType(.heartRate)) else { return }
        Task { @MainActor in
            guard
                let statistics = workoutBuilder.statistics(
                    for: HKQuantityType(.heartRate)
                ), let quantity = statistics.mostRecentQuantity()
            else { return }
            let unit = HKUnit.count().unitDivided(by: .minute())
            self.heartRate = Int(quantity.doubleValue(for: unit).rounded())
        }
    }

    private func reset() {
        workoutSession = nil
        builder = nil
        state = .idle
        heartRate = nil
    }
}
