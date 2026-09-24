import SwiftUI

struct SetLoggerView: View {
    @Environment(WorkoutCoordinator.self) private var coordinator
    @ScaledMetric(relativeTo: .title2) private var valueSize = 30.0
    @ScaledMetric(relativeTo: .caption2) private var labelSize = 9.0
    @ScaledMetric(relativeTo: .body) private var editorHeight = 49.0
    @State private var metric: Metric = .reps
    @FocusState private var focusedMetric: Metric?

    private enum Metric: Hashable {
        case reps
        case load
    }

    private var isTimed: Bool {
        coordinator.selectedExercise?.exerciseType == .time
    }

    var body: some View {
        Group {
            if isTimed {
                timedEditor
            } else {
                weightEditor
            }
        }
        // Numbers are already display-sized; cap growth so both wells stay on screen.
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
    }

    private var weightEditor: some View {
        HStack(spacing: 3) {
            metricEditor(
                .reps,
                label: String(localized: "REPS"),
                value: String(coordinator.reps)
            )
            metricEditor(
                .load,
                label: coordinator.weightUnit.uppercased(),
                value: WatchDisplay.load(coordinator.loadKg, unit: coordinator.weightUnit)
            )
        }
        .frame(maxWidth: .infinity)
        .frame(height: editorHeight)
        .accessibilityElement(children: .contain)
    }

    private var timedEditor: some View {
        metricEditor(
            .reps,
            label: String(localized: "TIME"),
            value: timerValue,
            isDuration: true
        )
        .frame(maxWidth: .infinity)
        .frame(height: editorHeight)
        .accessibilityElement(children: .contain)
    }

    private var timerValue: String {
        WatchSummary.duration(
            TimeInterval(
                coordinator.timedSetEnd == nil
                    ? coordinator.durationSeconds
                    : coordinator.timedSetRemaining
            )
        )
    }

    private var repsBinding: Binding<Double> {
        Binding(
            get: { Double(coordinator.reps) },
            set: { coordinator.updateEditor(loadKg: coordinator.loadKg, reps: Int($0.rounded())) }
        )
    }

    private var loadBinding: Binding<Double> {
        Binding(
            get: { coordinator.displayedLoad },
            set: { coordinator.updateDisplayedLoad($0) }
        )
    }

    private var durationBinding: Binding<Double> {
        Binding(
            get: { Double(coordinator.durationSeconds) },
            set: { if coordinator.timedSetEnd == nil { coordinator.updateDuration(Int($0.rounded())) } }
        )
    }

    private func metricEditor(
        _ candidate: Metric,
        label: String,
        value: String,
        isDuration: Bool = false
    ) -> some View {
        let isSelected = metric == candidate
        let isRunning = isDuration && coordinator.timedSetEnd != nil
        let tint = isRunning ? WatchTheme.success : WatchTheme.primary
        return Button {
            metric = candidate
            focusedMetric = candidate
        } label: {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 3) {
                    Text(label)
                        .font(.system(size: labelSize, weight: .bold))
                        .foregroundStyle(isSelected ? tint : .secondary)
                    Spacer(minLength: 0)
                    if isSelected && !isRunning {
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.system(size: labelSize, weight: .bold))
                            .foregroundStyle(tint)
                            .accessibilityHidden(true)
                    }
                }
                Text(value)
                    .font(.system(size: valueSize, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .contentTransition(.numericText())
                    .foregroundStyle(isSelected || isRunning ? Color.primary : Color.primary.opacity(0.55))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 7)
            .frame(maxWidth: .infinity, minHeight: editorHeight)
            .background(
                RoundedRectangle(cornerRadius: WatchLayout.dataRadius)
                    .fill(isSelected ? tint.opacity(0.16) : WatchTheme.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: WatchLayout.dataRadius)
                    .strokeBorder(isSelected ? tint : .clear, lineWidth: 1.5)
            )
            .animation(.snappy(duration: 0.2), value: value)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .focusable()
        .focused($focusedMetric, equals: candidate)
        .onAppear { if candidate == .reps { focusedMetric = .reps } }
        .onChange(of: focusedMetric) { _, value in if let value { metric = value } }
        .digitalCrownRotation(
            crownBinding(for: candidate, isDuration: isDuration),
            from: isDuration ? 1 : 0,
            through: isDuration ? 3600 : (candidate == .reps ? 1000 : (coordinator.weightUnit == "lbs" ? 3306.9 : 1500)),
            by: isDuration ? 5 : (candidate == .load && coordinator.weightUnit != "lbs" ? 0.5 : 1),
            sensitivity: .medium,
            isContinuous: false,
            isHapticFeedbackEnabled: true
        )
        .accessibilityLabel(watchLocalizedFormat("%@, %@", label, value))
        .accessibilityAddTraits(metric == candidate ? .isSelected : [])
        .accessibilityAdjustableAction { direction in
            adjust(candidate, direction: direction, isDuration: isDuration)
        }
    }

    private func crownBinding(for candidate: Metric, isDuration: Bool) -> Binding<Double> {
        if isDuration { return durationBinding }
        return candidate == .reps ? repsBinding : loadBinding
    }

    private func adjust(
        _ candidate: Metric,
        direction: AccessibilityAdjustmentDirection,
        isDuration: Bool
    ) {
        let amount = direction == .increment ? 1 : -1
        if isDuration {
            coordinator.updateDuration(coordinator.durationSeconds + amount * 5)
        } else if candidate == .reps {
            coordinator.updateEditor(
                loadKg: coordinator.loadKg,
                reps: max(0, coordinator.reps + amount)
            )
        } else {
            let increment = coordinator.weightUnit == "lbs" ? 1.0 : 0.5
            coordinator.updateDisplayedLoad(
                max(0, coordinator.displayedLoad + Double(amount) * increment)
            )
        }
    }
}
