import SwiftUI
import WatchKit

func watchLocalizedFormat(
    _ key: String,
    _ arguments: CVarArg...
) -> String {
    // Swift Int has a different C format width across Apple Watch ABIs.
    // Normalize it to Int64 so localized %lld placeholders are always valid.
    let normalizedArguments: [CVarArg] = arguments.map { argument in
        if let value = argument as? Int {
            return Int64(value)
        }
        return argument
    }

    return String(
        format: NSLocalizedString(key, comment: ""),
        locale: Locale.current,
        arguments: normalizedArguments
    )
}

@main
struct WorkoutWatchApp: App {
    @WKApplicationDelegateAdaptor(WorkoutRecoveryDelegate.self) private var recoveryDelegate
    @State private var coordinator: WorkoutCoordinator

    init() {
        let coordinator = WorkoutCoordinator()
        _coordinator = State(initialValue: coordinator)
        WorkoutRecoveryDelegate.coordinator = coordinator
    }
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(coordinator)
                .preferredColorScheme(.dark)
                .transformEnvironment(\.dynamicTypeSize) { size in
                    #if DEBUG
                    if coordinator.isPreview, ProcessInfo.processInfo.arguments.contains("--large-text") {
                        size = .accessibility2
                    }
                    #endif
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { coordinator.start(); coordinator.connectivity.requestState() }
                    else { coordinator.saveEditor() }
                }
        }
        .backgroundTask(.watchConnectivity) {
            await coordinator.waitForPendingConnectivityContent()
        }
    }
}

enum WatchTheme {
    static let background = Color(red: 0.071, green: 0.078, blue: 0.086)
    static let surface = Color(red: 0.102, green: 0.114, blue: 0.125)
    static let primary = Color(red: 0.353, green: 0.682, blue: 0.878)
    static let success = Color(red: 0.188, green: 0.820, blue: 0.345)
    static let gold = Color(red: 1.0, green: 0.773, blue: 0.239)
}

@MainActor
final class WorkoutRecoveryDelegate: NSObject, WKApplicationDelegate {
    static weak var coordinator: WorkoutCoordinator?

    func handleActiveWorkoutRecovery() {
        Task { @MainActor in
            guard let coordinator = Self.coordinator else { return }
            _ = await coordinator.health.recoverActiveWorkoutSession()
            coordinator.start()
        }
    }
}
