import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Widget Declaration

struct SweatyLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: SweatyWorkoutAttributes.self) { context in
      LockScreenView(state: context.state)
        .widgetURL(workoutURL(for: context.attributes))
        .activitySystemActionForegroundColor(Color("widgetAccent"))
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
      .widgetURL(workoutURL(for: context.attributes))
      .keylineTint(Color("widgetAccent"))
    }
  }
}

/// Tapping any Live Activity surface should return to the active workout.
/// URLComponents performs the necessary percent-encoding if a future workout
/// identifier contains characters that are not valid in a URL's query value.
private func workoutURL(for attributes: SweatyWorkoutAttributes) -> URL? {
  var components = URLComponents()
  components.scheme = "sweaty"
  components.host = "workout"
  components.queryItems = [
    URLQueryItem(name: "workoutId", value: attributes.workoutId),
  ]
  return components.url
}

// MARK: - Mode helpers

private extension SweatyWorkoutAttributes.ContentState {
  /// Returns the live rest interval iff a rest period is currently running
  /// AND has not yet ended. Avoids "rest mode" sticking around past 0:00.
  var activeRest: ClosedRange<Date>? {
    guard !isWorkoutComplete else { return nil }
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

      if state.isWorkoutComplete {
        CompletedWorkoutLockScreen(state: state)
      } else if let rest = state.activeRest {
        RestModeLockScreen(state: state, rest: rest)
      } else {
        ActiveSetLockScreen(state: state)
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
    .activityBackgroundTint(Color("widgetAccent").opacity(0.10))
  }
}

private struct CompletedWorkoutLockScreen: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    HStack(alignment: .center, spacing: 12) {
      Image(systemName: "checkmark.circle.fill")
        .font(.system(size: 32, weight: .semibold))
        .foregroundColor(Color("widgetSuccess"))

      VStack(alignment: .leading, spacing: 3) {
        Text("WORKOUT COMPLETE")
          .font(.system(size: 14, weight: .bold))
          .kerning(0.5)
          .foregroundColor(.primary)

        if !state.workoutName.isEmpty {
          Text(state.workoutName)
            .font(.caption)
            .foregroundColor(.secondary)
            .lineLimit(1)
            .minimumScaleFactor(0.85)
        }
      }

      Spacer(minLength: 0)
    }
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
          .foregroundColor(.primary)

        if !state.workoutName.isEmpty {
          Text(state.workoutName)
            .font(.caption)
            .foregroundColor(.secondary)
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
          .foregroundColor(Color("widgetAccent"))

        Text(timerInterval: rest, countsDown: true)
          .font(.system(size: 36, weight: .bold))
          .monospacedDigit()
          .kerning(-1.0)
          .foregroundColor(.primary)
          .lineLimit(1)
          .minimumScaleFactor(0.7)

        Spacer(minLength: 8)

        Text("Up next  ")
          .font(.system(size: 10, weight: .medium))
          .kerning(0.4)
          .foregroundColor(Color.secondary.opacity(0.6))
          + Text(state.proposalDisplay)
          .font(.system(size: 12, weight: .semibold).monospacedDigit())
          .foregroundColor(.secondary)
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
    if state.isWorkoutComplete {
      Image(systemName: "checkmark.circle.fill")
        .foregroundColor(Color("widgetSuccess"))
        .font(.caption)
    } else if state.activeRest != nil {
      Image(systemName: "timer")
        .foregroundColor(Color("widgetAccent"))
        .font(.caption)
    } else {
      Image(systemName: "dumbbell.fill")
        .foregroundColor(Color("widgetAccent"))
        .font(.caption)
    }
  }
}

private struct CompactTrailing: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    if state.isWorkoutComplete {
      Text("DONE")
        .font(.caption2.weight(.semibold))
        .foregroundColor(Color("widgetSuccess"))
    } else if let rest = state.activeRest {
      Text(timerInterval: rest, countsDown: true, showsHours: false)
        .font(.caption2.monospacedDigit().weight(.semibold))
        .foregroundColor(Color("widgetAccent"))
        .frame(minWidth: 36)
    } else {
      Text("\(state.currentSetNumber)/\(state.totalSets)")
        .font(.caption2.monospacedDigit().weight(.semibold))
        .foregroundColor(Color("widgetAccent"))
    }
  }
}

private struct MinimalView: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    if state.isWorkoutComplete {
      Image(systemName: "checkmark.circle.fill")
        .foregroundColor(Color("widgetSuccess"))
    } else if let rest = state.activeRest {
      Text(timerInterval: rest, countsDown: true, showsHours: false)
        .font(.caption2.monospacedDigit().weight(.bold))
        .foregroundColor(Color("widgetAccent"))
    } else {
      Text("\(state.currentSetNumber)/\(state.totalSets)")
        .font(.caption2.monospacedDigit().weight(.semibold))
        .foregroundColor(Color("widgetAccent"))
    }
  }
}

// MARK: - Dynamic Island — expanded regions

private struct ExpandedLeading: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    HStack(spacing: 6) {
      if state.isWorkoutComplete {
        Image(systemName: "checkmark.circle.fill")
          .font(.caption2)
          .foregroundColor(Color("widgetSuccess"))
        Text("COMPLETE")
          .font(.caption.weight(.semibold))
          .kerning(0.6)
          .foregroundColor(Color("widgetSuccess"))
      } else if state.activeRest != nil {
        Image(systemName: "timer")
          .font(.caption2)
          .foregroundColor(Color("widgetAccent"))
        Text("RESTING")
          .font(.caption.weight(.semibold))
          .kerning(0.6)
          .foregroundColor(Color("widgetAccent"))
      } else {
        Image(systemName: "dumbbell.fill")
          .font(.caption2)
          .foregroundColor(Color("widgetAccent"))
        Text(state.workoutName.isEmpty ? "WORKOUT" : state.workoutName)
          .font(.caption.weight(.semibold))
          .lineLimit(1)
          .minimumScaleFactor(0.8)
          .foregroundColor(Color("widgetAccent"))
      }
    }
    .padding(.leading, 4)
  }
}

private struct ExpandedTrailing: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    HStack(spacing: 4) {
      Image(systemName: "stopwatch.fill")
        .font(.caption2)
      Text(timerInterval: state.workoutStartedAt ... .distantFuture, countsDown: false)
        .font(.caption.monospacedDigit().weight(.medium))
        .multilineTextAlignment(.trailing)
    }
    .foregroundColor(.secondary)
    .frame(maxWidth: 88, alignment: .trailing)
    .padding(.trailing, 4)
  }
}

private struct ExpandedBottom: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    if state.isWorkoutComplete {
      CompletedWorkoutExpanded(state: state)
        .padding(.horizontal, 4)
    } else if let rest = state.activeRest {
      RestModeExpanded(state: state, rest: rest)
        .padding(.horizontal, 4)
    } else {
      ActiveSetExpanded(state: state)
        .padding(.horizontal, 4)
    }
  }
}

private struct CompletedWorkoutExpanded: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    HStack(alignment: .center, spacing: 10) {
      Image(systemName: "checkmark.circle.fill")
        .font(.system(size: 26, weight: .semibold))
        .foregroundColor(Color("widgetSuccess"))

      VStack(alignment: .leading, spacing: 2) {
        Text("WORKOUT COMPLETE")
          .font(.caption.weight(.bold))
          .kerning(0.5)
          .foregroundColor(.primary)

        if !state.workoutName.isEmpty {
          Text(state.workoutName)
            .font(.caption2)
            .foregroundColor(.secondary)
            .lineLimit(1)
            .minimumScaleFactor(0.85)
        }
      }

      Spacer(minLength: 0)
    }
  }
}

private struct ActiveSetExpanded: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .center, spacing: 10) {
        VStack(alignment: .leading, spacing: 3) {
          Text(state.exerciseName)
            .font(.system(size: 15, weight: .bold))
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .foregroundColor(.primary)

          Text(state.proposalDisplay)
            .font(.system(size: 21, weight: .bold))
            .monospacedDigit()
            .kerning(-0.3)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .foregroundColor(Color("widgetAccent"))
        }

        Spacer(minLength: 8)

        VStack(alignment: .trailing, spacing: 5) {
          SetPill(state: state)

          if #available(iOS 18.0, *) {
            SetDoneButton(
              exerciseId: state.exerciseId,
              setId: state.setId,
              size: 32
            )
          }
        }
      }

      WorkoutProgress(state: state)
    }
  }
}

private struct RestModeExpanded: View {
  let state: SweatyWorkoutAttributes.ContentState
  let rest: ClosedRange<Date>

  var body: some View {
    VStack(alignment: .leading, spacing: 9) {
      HStack(alignment: .center, spacing: 12) {
        Text(timerInterval: rest, countsDown: true)
          .font(.system(size: 30, weight: .bold))
          .monospacedDigit()
          .kerning(-0.8)
          .foregroundColor(Color("widgetAccent"))
          .lineLimit(1)
          .minimumScaleFactor(0.7)

        Spacer(minLength: 8)

        if #available(iOS 18.0, *) {
          SkipRestButton(prominent: false)
        }
      }

      RestProgressBar(rest: rest)

      HStack(alignment: .center, spacing: 8) {
        VStack(alignment: .leading, spacing: 2) {
          Text("UP NEXT")
            .font(.system(size: 9, weight: .semibold))
            .kerning(0.7)
            .foregroundColor(Color("widgetAccent"))
          Text(state.exerciseName)
            .font(.caption.weight(.semibold))
            .foregroundColor(.primary)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
        }

        Spacer(minLength: 6)

        VStack(alignment: .trailing, spacing: 2) {
          SetPill(state: state)
          Text(state.proposalDisplay)
            .font(.caption2.weight(.semibold).monospacedDigit())
            .foregroundColor(.secondary)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
        }
      }

      WorkoutProgress(state: state)
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
        .foregroundColor(Color("widgetAccent"))

      Text(state.exerciseName.uppercased())
        .font(.system(size: 11, weight: .semibold))
        .kerning(0.6)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
        .foregroundColor(.secondary)

      if state.isWorkoutComplete {
        Text("·")
          .font(.system(size: 11, weight: .semibold))
          .foregroundColor(Color.secondary.opacity(0.6))

        Text("COMPLETE")
          .font(.system(size: 11, weight: .semibold))
          .kerning(0.6)
          .foregroundColor(Color("widgetSuccess"))
      } else {
        Text("·")
          .font(.system(size: 11, weight: .semibold))
          .foregroundColor(Color.secondary.opacity(0.6))

        Text("SET \(state.currentSetNumber) / \(state.totalSets)")
          .font(.system(size: 11, weight: .semibold).monospacedDigit())
          .kerning(0.6)
          .foregroundColor(.secondary)
      }

      Spacer(minLength: 8)

      Image(systemName: "timer")
        .font(.system(size: 10, weight: .semibold))
        .foregroundColor(Color.secondary.opacity(0.6))

      Text(timerInterval: state.workoutStartedAt ... .distantFuture, countsDown: false)
        .font(.system(size: 11, weight: .semibold).monospacedDigit())
        .foregroundColor(.secondary)
        .frame(minWidth: 44, alignment: .trailing)
    }
  }
}

private struct SetPill: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    Text("SET \(state.currentSetNumber)/\(state.totalSets)")
      .font(.system(size: 10, weight: .bold).monospacedDigit())
      .kerning(0.4)
      .foregroundColor(Color("widgetAccent"))
      .padding(.horizontal, 7)
      .padding(.vertical, 4)
      .background(
        Capsule(style: .continuous)
          .fill(Color("widgetAccent").opacity(0.16))
      )
  }
}

private struct WorkoutProgress: View {
  let state: SweatyWorkoutAttributes.ContentState

  private var completed: Int {
    min(max(0, state.completedSets), max(1, state.totalWorkoutSets))
  }

  private var total: Int {
    max(1, state.totalWorkoutSets)
  }

  var body: some View {
    HStack(spacing: 8) {
      ProgressView(value: Double(completed), total: Double(total))
        .progressViewStyle(.linear)
        .tint(Color("widgetAccent"))

      Text("\(completed)/\(total) SETS")
        .font(.system(size: 9, weight: .semibold).monospacedDigit())
        .kerning(0.4)
        .foregroundColor(.secondary)
        .fixedSize()
    }
    .frame(height: 4)
  }
}

/// Live progress bar driven by ActivityKit's date-aware ProgressView.
/// Renders without the default percentage label and uses the app accent.
private struct RestProgressBar: View {
  let rest: ClosedRange<Date>

  var body: some View {
    ProgressView(timerInterval: rest, countsDown: true) {
      EmptyView()
    } currentValueLabel: {
      EmptyView()
    }
    .progressViewStyle(.linear)
    .tint(Color("widgetAccent"))
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
          .foregroundColor(.white)
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
  /// `prominent` = filled accent (Lock Screen), `false` = tinted ghost (DI).
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
      .foregroundColor(prominent ? Color.white : Color("widgetAccent"))
      .background(
        RoundedRectangle(cornerRadius: 999, style: .continuous)
          .fill(
            prominent
              ? Color("widgetAccent")
              : Color("widgetAccent").opacity(0.16)
          )
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
        .foregroundColor(.primary)
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
