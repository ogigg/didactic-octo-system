import SwiftUI

struct ContentView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    var body: some View {
        NavigationStack {
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
        }
        .task { coordinator.start() }
    }
}

struct WaitingView: View {
    @ScaledMetric(relativeTo: .headline) private var titleSize = 16.0
    @ScaledMetric(relativeTo: .caption) private var instructionSize = 12.0
    var body: some View {
        WatchScreen(
            title: String(localized: "Sweaty"),
            titleTint: WatchTheme.primary,
            headerAction: .details
        ) {
            VStack(spacing: 5) {
                Image(systemName: "figure.strengthtraining.traditional")
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(WatchTheme.primary)
                    .frame(width: 44, height: 44)
                    .background(WatchTheme.primary.opacity(0.16), in: Circle())
                    .shadow(color: WatchTheme.primary.opacity(0.45), radius: 10)
                    .accessibilityHidden(true)
                Text(String(localized: "Ready to train"))
                    .font(.system(size: titleSize, weight: .semibold, design: .rounded))
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
    @Environment(WorkoutCoordinator.self) private var coordinator
    let snapshot: WatchWorkoutSnapshot

    private var sets: [WatchSet] { snapshot.exercises.flatMap(\.sets) }

    var body: some View {
        WatchScreen(
            title: String(localized: "Complete"),
            titleTint: WatchTheme.success,
            headerAction: .details,
            accent: WatchTheme.success
        ) {
            VStack(spacing: 4) {
                Image(systemName: "checkmark")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(.black)
                    .frame(width: 30, height: 30)
                    .background(WatchTheme.success, in: Circle())
                    .shadow(color: WatchTheme.success.opacity(0.6), radius: 10)
                    .accessibilityHidden(true)
                Text(snapshot.name)
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .multilineTextAlignment(.center)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                HStack(spacing: 2) {
                    WatchStat(
                        label: String(localized: "TIME"),
                        value: WatchSummary.duration(
                            (snapshot.finishedAt ?? coordinator.now).timeIntervalSince(snapshot.startedAt)
                        )
                    )
                    WatchStat(
                        label: String(localized: "SETS"),
                        value: String(sets.filter(\.isCompleted).count)
                    )
                    WatchStat(
                        label: watchLocalizedFormat("VOLUME %@", coordinator.weightUnit.uppercased()),
                        value: WatchDisplay.load(WatchSummary.volumeKg(sets), unit: coordinator.weightUnit)
                    )
                }
                .padding(.vertical, 5)
                .background(WatchTheme.surface, in: RoundedRectangle(cornerRadius: WatchLayout.dataRadius))
                .dynamicTypeSize(...DynamicTypeSize.xxLarge)
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
