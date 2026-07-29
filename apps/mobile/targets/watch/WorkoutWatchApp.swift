import SwiftUI

@main
struct WorkoutWatchApp: App {
    @State private var coordinator = WorkoutCoordinator()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(coordinator)
                .preferredColorScheme(.dark)
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
