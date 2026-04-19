import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Widget Declaration

struct SweatyLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: SweatyWorkoutAttributes.self) { context in
      LockScreenView(state: context.state)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          ExpandedLeading(state: context.state)
        }
        DynamicIslandExpandedRegion(.trailing) {
          ExpandedTrailing(state: context.state)
        }
        DynamicIslandExpandedRegion(.bottom) {
          ExpandedBottom(state: context.state)
        }
      } compactLeading: {
        CompactLeading(state: context.state)
      } compactTrailing: {
        CompactTrailing(state: context.state)
      } minimal: {
        MinimalView(state: context.state)
      }
    }
  }
}

// MARK: - Mode helpers

private extension SweatyWorkoutAttributes.ContentState {
  /// Returns the live rest interval iff a rest period is currently running
  /// AND has not yet ended. Avoids "rest mode" sticking around past 0:00.
  var activeRest: ClosedRange<Date>? {
    guard let start = restStartedAt, let end = restEndsAt else { return nil }
    guard end > Date() else { return nil }
    return start ... end
  }
}

// MARK: - Lock Screen / Banner

private struct LockScreenView: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      ContextStrip(state: state)

      if let rest = state.activeRest {
        RestModeLockScreen(state: state, rest: rest)
      } else {
        ActiveSetLockScreen(state: state)
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
    .activityBackgroundTint(Color(.systemBackground).opacity(0.85))
  }
}

private struct ActiveSetLockScreen: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    HStack(alignment: .center, spacing: 12) {
      VStack(alignment: .leading, spacing: 4) {
        Text(state.proposalDisplay)
          .font(.system(size: 24, weight: .bold))
          .monospacedDigit()
          .kerning(-0.3)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
          .foregroundStyle(.primary)

        if !state.workoutName.isEmpty {
          Text(state.workoutName)
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .minimumScaleFactor(0.85)
        }
      }

      Spacer(minLength: 12)

      if #available(iOS 18.0, *) {
        SetDoneButton(
          exerciseId: state.exerciseId,
          setId: state.setId,
          size: 36
        )
      }
    }
  }
}

private struct RestModeLockScreen: View {
  let state: SweatyWorkoutAttributes.ContentState
  let rest: ClosedRange<Date>

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text("RESTING")
          .font(.system(size: 11, weight: .semibold))
          .kerning(0.8)
          .foregroundStyle(.orange)

        Text(timerInterval: rest, countsDown: true)
          .font(.system(size: 36, weight: .bold))
          .monospacedDigit()
          .kerning(-1.0)
          .foregroundStyle(.primary)
          .lineLimit(1)
          .minimumScaleFactor(0.7)

        Spacer(minLength: 8)

        Text("Up next  ")
          .font(.system(size: 10, weight: .medium))
          .kerning(0.4)
          .foregroundStyle(.tertiary)
          + Text(state.proposalDisplay)
          .font(.system(size: 12, weight: .semibold).monospacedDigit())
          .foregroundStyle(.secondary)
      }

      RestProgressBar(rest: rest)

      if #available(iOS 18.0, *) {
        HStack(spacing: 10) {
          AdjustRestButton(deltaSeconds: -15, label: "−15s")
          SkipRestButton(prominent: true)
          AdjustRestButton(deltaSeconds: 15, label: "+15s")
        }
        .padding(.top, 2)
      }
    }
  }
}

// MARK: - Dynamic Island — compact / minimal

private struct CompactLeading: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    if state.activeRest != nil {
      Image(systemName: "timer")
        .foregroundStyle(.orange)
        .font(.caption)
    } else {
      Image(systemName: "dumbbell.fill")
        .foregroundStyle(Color("widgetAccent"))
        .font(.caption)
    }
  }
}

private struct CompactTrailing: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    if let rest = state.activeRest {
      Text(timerInterval: rest, countsDown: true, showsHours: false)
        .font(.caption2.monospacedDigit().weight(.semibold))
        .foregroundStyle(.orange)
        .frame(minWidth: 36)
    } else {
      Text("\(state.currentSetNumber)/\(state.totalSets)")
        .font(.caption2.monospacedDigit().weight(.semibold))
        .foregroundStyle(.primary)
    }
  }
}

private struct MinimalView: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    if let rest = state.activeRest {
      Text(timerInterval: rest, countsDown: true, showsHours: false)
        .font(.caption2.monospacedDigit().weight(.bold))
        .foregroundStyle(.orange)
    } else {
      Text("\(state.currentSetNumber)/\(state.totalSets)")
        .font(.caption2.monospacedDigit().weight(.semibold))
        .foregroundStyle(.primary)
    }
  }
}

// MARK: - Dynamic Island — expanded regions

private struct ExpandedLeading: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    HStack(spacing: 6) {
      if state.activeRest != nil {
        Image(systemName: "timer")
          .font(.caption2)
          .foregroundStyle(.orange)
        Text("RESTING")
          .font(.caption.weight(.semibold))
          .kerning(0.6)
          .foregroundStyle(.orange)
      } else {
        Image(systemName: "dumbbell.fill")
          .font(.caption2)
          .foregroundStyle(Color("widgetAccent"))
        Text(state.exerciseName)
          .font(.caption.weight(.semibold))
          .lineLimit(1)
          .minimumScaleFactor(0.8)
          .foregroundStyle(.primary)
      }
    }
    .padding(.leading, 4)
  }
}

private struct ExpandedTrailing: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    Text(timerInterval: state.workoutStartedAt ... .distantFuture, countsDown: false)
      .font(.caption.monospacedDigit())
      .foregroundStyle(.secondary)
      .multilineTextAlignment(.trailing)
      .frame(maxWidth: 80, alignment: .trailing)
      .padding(.trailing, 4)
  }
}

private struct ExpandedBottom: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    if let rest = state.activeRest {
      RestModeExpanded(state: state, rest: rest)
        .padding(.horizontal, 4)
    } else {
      ActiveSetExpanded(state: state)
        .padding(.horizontal, 4)
    }
  }
}

private struct ActiveSetExpanded: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .center, spacing: 12) {
        VStack(alignment: .leading, spacing: 2) {
          Text(state.proposalDisplay)
            .font(.system(size: 22, weight: .bold))
            .monospacedDigit()
            .kerning(-0.3)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .foregroundStyle(.primary)

          MetaLine(state: state)
        }

        Spacer(minLength: 8)

        if #available(iOS 18.0, *) {
          SetDoneButton(
            exerciseId: state.exerciseId,
            setId: state.setId,
            size: 32
          )
        }
      }
    }
  }
}

private struct RestModeExpanded: View {
  let state: SweatyWorkoutAttributes.ContentState
  let rest: ClosedRange<Date>

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(alignment: .center, spacing: 12) {
        Text(timerInterval: rest, countsDown: true)
          .font(.system(size: 30, weight: .bold))
          .monospacedDigit()
          .kerning(-0.8)
          .foregroundStyle(.primary)
          .lineLimit(1)
          .minimumScaleFactor(0.7)

        Spacer(minLength: 8)

        if #available(iOS 18.0, *) {
          SkipRestButton(prominent: false)
        }
      }

      RestProgressBar(rest: rest)

      HStack(spacing: 4) {
        Text("UP NEXT")
          .font(.system(size: 10, weight: .semibold))
          .kerning(0.6)
          .foregroundStyle(.tertiary)
        Text(state.proposalDisplay)
          .font(.caption.weight(.semibold).monospacedDigit())
          .foregroundStyle(.secondary)
          .lineLimit(1)
          .minimumScaleFactor(0.85)
        Spacer(minLength: 0)
      }
    }
  }
}

// MARK: - Shared subviews

/// Tiny uppercase context strip:  `BENCH PRESS · SET 2 / 4         ⏱ 12:34`
private struct ContextStrip: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    HStack(spacing: 6) {
      Image(systemName: "dumbbell.fill")
        .font(.system(size: 10, weight: .semibold))
        .foregroundStyle(Color("widgetAccent"))

      Text(state.exerciseName.uppercased())
        .font(.system(size: 11, weight: .semibold))
        .kerning(0.6)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .foregroundStyle(.secondary)

      Text("·")
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(.tertiary)

      Text("SET \(state.currentSetNumber) / \(state.totalSets)")
        .font(.system(size: 11, weight: .semibold).monospacedDigit())
        .kerning(0.6)
        .foregroundStyle(.secondary)

      Spacer(minLength: 8)

      Image(systemName: "timer")
        .font(.system(size: 10, weight: .semibold))
        .foregroundStyle(.tertiary)

      Text(timerInterval: state.workoutStartedAt ... .distantFuture, countsDown: false)
        .font(.system(size: 11, weight: .semibold).monospacedDigit())
        .foregroundStyle(.secondary)
        .frame(minWidth: 44, alignment: .trailing)
    }
  }
}

/// Caption line under the hero proposal in the DI expanded view.
private struct MetaLine: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    let workout = state.workoutName.trimmingCharacters(in: .whitespacesAndNewlines)
    let label = workout.isEmpty ? "Set \(state.currentSetNumber) of \(state.totalSets)" : workout
    Text(label)
      .font(.caption2)
      .foregroundStyle(.secondary)
      .lineLimit(1)
      .minimumScaleFactor(0.85)
  }
}

/// Live progress bar driven by ActivityKit's date-aware ProgressView.
/// Renders without the default percentage label and tints the fill orange.
private struct RestProgressBar: View {
  let rest: ClosedRange<Date>

  var body: some View {
    ProgressView(timerInterval: rest, countsDown: true) {
      EmptyView()
    } currentValueLabel: {
      EmptyView()
    }
    .progressViewStyle(.linear)
    .tint(.orange)
    .scaleEffect(x: 1, y: 0.6, anchor: .center)
    .frame(height: 4)
  }
}

/// Mirrors `components/workout/set-row.tsx` — rounded-square, success-green
/// fill, white SF-symbol checkmark inside. Acts as the "tap to complete" CTA.
@available(iOS 18.0, *)
private struct SetDoneButton: View {
  let exerciseId: String
  let setId: String
  let size: CGFloat

  var body: some View {
    Button(intent: MarkSetDoneIntent(exerciseId: exerciseId, setId: setId)) {
      ZStack {
        RoundedRectangle(cornerRadius: 8, style: .continuous)
          .fill(Color("widgetSuccess"))
        RoundedRectangle(cornerRadius: 8, style: .continuous)
          .strokeBorder(Color.white.opacity(0.18), lineWidth: 1)
        Image(systemName: "checkmark")
          .font(.system(size: size * 0.5, weight: .bold))
          .foregroundStyle(.white)
      }
      .frame(width: size, height: size)
      .contentShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Mark set done")
  }
}

@available(iOS 18.0, *)
private struct SkipRestButton: View {
  /// `prominent` = filled orange (Lock Screen), `false` = ghost outline (DI).
  let prominent: Bool

  var body: some View {
    Button(intent: SkipRestIntent()) {
      HStack(spacing: 4) {
        Image(systemName: "forward.end.fill")
          .font(.system(size: 11, weight: .bold))
        Text("Skip")
          .font(.system(size: 13, weight: .semibold))
      }
      .frame(maxWidth: prominent ? .infinity : nil)
      .padding(.vertical, prominent ? 9 : 7)
      .padding(.horizontal, prominent ? 14 : 12)
      .foregroundStyle(prominent ? Color.white : Color.orange)
      .background(
        RoundedRectangle(cornerRadius: 999, style: .continuous)
          .fill(prominent ? Color.orange : Color.orange.opacity(0.16))
      )
      .contentShape(RoundedRectangle(cornerRadius: 999, style: .continuous))
    }
    .buttonStyle(.plain)
    .accessibilityLabel("Skip rest")
  }
}

@available(iOS 18.0, *)
private struct AdjustRestButton: View {
  let deltaSeconds: Int
  let label: String

  var body: some View {
    Button(intent: AdjustRestIntent(deltaSeconds: deltaSeconds)) {
      Text(label)
        .font(.system(size: 13, weight: .semibold).monospacedDigit())
        .padding(.vertical, 9)
        .padding(.horizontal, 14)
        .foregroundStyle(.primary)
        .background(
          RoundedRectangle(cornerRadius: 999, style: .continuous)
            .strokeBorder(Color.primary.opacity(0.12), lineWidth: 1)
        )
        .contentShape(RoundedRectangle(cornerRadius: 999, style: .continuous))
    }
    .buttonStyle(.plain)
    .accessibilityLabel(deltaSeconds > 0 ? "Add \(deltaSeconds) seconds" : "Remove \(-deltaSeconds) seconds")
  }
}
