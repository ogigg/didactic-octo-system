import SwiftUI

/// One segment per set: done sets fill green, the current set glows in the accent.
struct SetProgressBar: View {
    let sets: [WatchSet]
    let currentSetID: String?

    var body: some View {
        HStack(spacing: 3) {
            ForEach(sets) { set in
                Capsule()
                    .fill(color(for: set))
                    .frame(height: 4)
                    .shadow(
                        color: set.id == currentSetID ? WatchTheme.primary.opacity(0.7) : .clear,
                        radius: 3
                    )
            }
        }
        .accessibilityHidden(true)
    }

    private func color(for set: WatchSet) -> Color {
        if set.isCompleted { return WatchTheme.success }
        if set.id == currentSetID { return WatchTheme.primary }
        return WatchTheme.surface
    }
}

/// Confirms ending the workout. Once every set is done it reads as finishing
/// rather than abandoning, on every screen that offers it.
private struct WorkoutEndConfirmation: ViewModifier {
    @Environment(WorkoutCoordinator.self) private var coordinator
    @Binding var isPresented: Bool
    let isFinish: Bool

    func body(content: Content) -> some View {
        content.confirmationDialog(
            isFinish ? String(localized: "Finish workout?") : String(localized: "End workout?"),
            isPresented: $isPresented,
            titleVisibility: .visible
        ) {
            Button(
                isFinish ? String(localized: "Finish workout") : String(localized: "End workout"),
                role: .destructive
            ) {
                coordinator.finishWorkout()
            }
            Button(String(localized: "Cancel"), role: .cancel) {}
        } message: {
            Text("You can still review this workout on your iPhone")
        }
    }
}

extension View {
    func workoutEndConfirmation(isPresented: Binding<Bool>, isFinish: Bool) -> some View {
        modifier(WorkoutEndConfirmation(isPresented: isPresented, isFinish: isFinish))
    }
}

/// A compact labelled number used on summary screens.
struct WatchStat: View {
    let label: String
    let value: String
    var tint: Color = .primary

    var body: some View {
        VStack(spacing: 0) {
            Text(value)
                .font(.system(size: 15, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(tint)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(label)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

enum WatchSummary {
    static func volumeKg(_ sets: [WatchSet]) -> Double {
        sets.filter(\.isCompleted).reduce(0) { total, set in
            total + (set.actualLoadKg ?? set.targetLoadKg ?? 0)
                * (set.actualReps ?? set.targetReps ?? 0)
        }
    }

    static func duration(_ seconds: TimeInterval) -> String {
        let total = max(0, Int(seconds))
        let hours = total / 3600
        let minutes = total % 3600 / 60
        return hours > 0
            ? String(format: "%d:%02d:%02d", hours, minutes, total % 60)
            : String(format: "%d:%02d", minutes, total % 60)
    }

    static func setsAndVolume(_ sets: [WatchSet], unit: String) -> String {
        let completed = sets.filter(\.isCompleted).count
        let volume = volumeKg(sets)
        guard volume > 0 else { return watchLocalizedFormat("%lld sets", completed) }
        return watchLocalizedFormat(
            "%lld sets · %@",
            completed,
            WatchDisplay.loadWithUnit(volume, unit: unit)
        )
    }
}
