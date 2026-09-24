import SwiftUI

struct WorkoutDetailsView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator

    private var lastCompletedSet: WatchSet? {
        coordinator.selectedExercise?.sets.last(where: \.isCompleted)
    }

    var body: some View {
        WatchScreen(
            title: String(localized: "Details"),
            contentScrolls: true,
            onBack: { coordinator.goBack() },
            headerAction: .none
        ) {
            ScrollView {
                VStack(alignment: .leading, spacing: 6) {
                    if let snapshot = coordinator.snapshot {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(snapshot.name)
                                .font(.system(.headline, design: .rounded))
                            Text(watchLocalizedFormat("%lld/%lld sets", coordinator.completedSetCount, coordinator.totalSetCount))
                                .font(.caption2)
                                .monospacedDigit()
                                .foregroundStyle(.secondary)
                        }
                    }

                    SyncStatusSummary()

                    HStack(spacing: 4) {
                        pillButton(String(localized: "Sync now"), symbol: "arrow.triangle.2.circlepath") {
                            coordinator.connectivity.requestState()
                        }
                        pillButton(String(localized: "Heart rate"), symbol: "heart.fill", tint: WatchTheme.heart) {
                            coordinator.navigate(.heartRate)
                        }
                    }

                    if coordinator.healthSaveFailed {
                        Button(String(localized: "Try Apple Health again")) {
                            coordinator.retryHealthWorkout()
                        }
                        .buttonStyle(.bordered)
                        .tint(WatchTheme.gold)
                        .frame(maxWidth: .infinity, minHeight: 32)
                    }

                    if let exercise = coordinator.selectedExercise {
                        sectionLabel(exercise.name)

                        if let notes = exercise.notes, !notes.isEmpty {
                            Text(notes)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, 2)
                        }

                        ForEach(Array(exercise.sets.enumerated()), id: \.element.id) { index, set in
                            setRow(set, number: index + 1)
                        }

                        if let lastCompletedSet, coordinator.snapshot?.status == .active {
                            Button(role: .destructive) {
                                coordinator.reopenSet(lastCompletedSet.id)
                            } label: {
                                Label(String(localized: "Undo last set"), systemImage: "arrow.uturn.backward")
                                    .font(.system(.footnote, design: .rounded).weight(.semibold))
                                    .foregroundStyle(WatchTheme.danger)
                                    .frame(maxWidth: .infinity, minHeight: 32)
                            }
                            .buttonStyle(WatchPressStyle())
                        }
                    } else {
                        Text(String(localized: "No workout details yet"))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.bottom, 6)
            }
            .scrollIndicators(.hidden)
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundStyle(WatchTheme.primary)
            .lineLimit(2)
            .padding(.top, 4)
            .padding(.horizontal, 2)
    }

    private func pillButton(
        _ title: String,
        symbol: String,
        tint: Color = WatchTheme.primary,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(spacing: 2) {
                Image(systemName: symbol)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(tint)
                Text(title)
                    .font(.system(size: 10, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, minHeight: 40)
            .background(WatchTheme.surface, in: RoundedRectangle(cornerRadius: WatchLayout.cardRadius))
        }
        .buttonStyle(WatchPressStyle())
    }

    private func setRow(_ set: WatchSet, number: Int) -> some View {
        let isCurrent = set.id == coordinator.currentSet?.id
        return HStack(spacing: 7) {
            Text(set.type == .warmup ? "W" : String(number))
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundStyle(set.isCompleted ? .black : (set.type == .warmup ? WatchTheme.gold : .primary))
                .frame(width: 20, height: 20)
                .background(
                    Circle().fill(
                        set.isCompleted
                            ? WatchTheme.success
                            : (isCurrent ? WatchTheme.primary.opacity(0.25) : WatchTheme.inset)
                    )
                )
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 0) {
                Text(WatchDisplay.set(set, unit: coordinator.weightUnit))
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(set.isCompleted || isCurrent ? .primary : .secondary)
                Text(watchLocalizedFormat("Target %@", WatchDisplay.set(set, unit: coordinator.weightUnit, target: true)))
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                if let previous = set.previousDisplay {
                    Text(watchLocalizedFormat("Previous %@", previous))
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if set.isCompleted {
                Button { coordinator.reopenSet(set.id) } label: {
                    Image(systemName: "arrow.uturn.backward")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: 28, height: 28)
                        .background(WatchTheme.inset, in: Circle())
                }
                .buttonStyle(.plain)
                .disabled(coordinator.snapshot?.status != .active)
                .accessibilityLabel(String(localized: "Reopen set"))
            }
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 6)
        .background(
            RoundedRectangle(cornerRadius: WatchLayout.dataRadius)
                .fill(isCurrent ? WatchTheme.primary.opacity(0.12) : WatchTheme.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: WatchLayout.dataRadius)
                .strokeBorder(isCurrent ? WatchTheme.primary.opacity(0.6) : .clear, lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }
}
