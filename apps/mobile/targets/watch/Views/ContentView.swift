import SwiftUI

struct ContentView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    var body: some View {
        ZStack {
            WatchTheme.background
                .ignoresSafeArea()

            Group {
                if coordinator.screen == .details {
                    WorkoutDetailsView()
                } else if let snapshot = coordinator.snapshot {
                    if snapshot.status == .completed {
                        WorkoutCompleteView(snapshot: snapshot)
                    } else if snapshot.status == .active {
                        ActiveWorkoutView()
                    } else {
                        WaitingView()
                    }
                } else {
                    WaitingView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .task { coordinator.start() }
    }
}

struct WaitingView: View {
    @ScaledMetric(relativeTo: .headline) private var titleSize = 15.0
    @ScaledMetric(relativeTo: .caption) private var instructionSize = 12.0
    var body: some View {
        WatchScreen(
            title: String(localized: "Sweaty"),
            headerAction: .details
        ) {
            VStack(spacing: 4) {
                Image(systemName: "figure.strengthtraining.traditional")
                    .font(.system(size: 24))
                    .foregroundStyle(WatchTheme.primary)
                    .accessibilityHidden(true)
                Text(String(localized: "Ready to train"))
                    .font(.system(size: titleSize, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                Text(String(localized: "Start a workout on your iPhone"))
                    .font(.system(size: instructionSize))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
            .accessibilityElement(children: .combine)
        }
    }
}

struct WorkoutCompleteView: View {
    let snapshot: WatchWorkoutSnapshot

    private var completedSets: Int {
        snapshot.exercises.flatMap(\.sets).filter(\.isCompleted).count
    }

    var body: some View {
        WatchScreen(
            title: String(localized: "Complete"),
            headerAction: .details
        ) {
            VStack(spacing: 4) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(WatchTheme.success)
                    .accessibilityHidden(true)
                Text(snapshot.name)
                    .font(.system(size: 13, weight: .semibold))
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .frame(height: 30)
                Text(watchLocalizedFormat("%lld sets", completedSets))
                    .font(.caption)
                Text(String(localized: "Full summary on iPhone"))
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity)

        }
    }

}
