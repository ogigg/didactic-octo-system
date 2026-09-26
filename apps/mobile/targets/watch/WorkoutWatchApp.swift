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
    // Pure black blends the app into the watch bezel on OLED displays.
    static let background = Color.black
    static let surface = Color(red: 0.110, green: 0.122, blue: 0.137)
    // Input wells sit darker than the card that contains them.
    static let inset = Color(red: 0.047, green: 0.055, blue: 0.063)
    static let primary = Color(red: 0.353, green: 0.682, blue: 0.878)
    static let success = Color(red: 0.188, green: 0.820, blue: 0.345)
    static let gold = Color(red: 1.0, green: 0.773, blue: 0.239)
    static let danger = Color(red: 1.0, green: 0.388, blue: 0.353)
    static let heart = Color(red: 1.0, green: 0.216, blue: 0.373)
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
