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
        // Expanded regions
        DynamicIslandExpandedRegion(.leading) {
          expandedLeading(state: context.state)
        }
        DynamicIslandExpandedRegion(.trailing) {
          expandedTrailing(state: context.state)
        }
        DynamicIslandExpandedRegion(.bottom) {
          expandedBottom(state: context.state)
        }
      } compactLeading: {
        Image(systemName: "dumbbell.fill")
          .foregroundStyle(Color("widgetAccent"))
          .font(.caption)
      } compactTrailing: {
        compactTimer(state: context.state)
      } minimal: {
        compactTimer(state: context.state)
      }
    }
  }
}

// MARK: - Lock Screen View

private struct LockScreenView: View {
  let state: SweatyWorkoutAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack {
        Image(systemName: "dumbbell.fill")
          .foregroundStyle(Color("widgetAccent"))
        Text(state.exerciseName)
          .font(.headline)
          .lineLimit(1)
        Spacer()
        // Workout elapsed timer
        Text(timerInterval: state.workoutStartedAt ... .distantFuture, countsDown: false)
          .font(.subheadline.monospacedDigit())
          .foregroundStyle(.secondary)
      }

      Text(state.setDisplay)
        .font(.title2.bold())

      if let restStartedAt = state.restStartedAt, let restEndsAt = state.restEndsAt {
        HStack(spacing: 6) {
          Image(systemName: "timer")
            .foregroundStyle(.orange)
            .font(.caption)
          Text(timerInterval: restStartedAt ... restEndsAt, countsDown: true)
            .font(.subheadline.monospacedDigit())
            .foregroundStyle(.orange)
          Text("rest")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      }

      if #available(iOS 17.0, *) {
        Button(
          intent: MarkSetDoneIntent(
            exerciseId: state.exerciseId,
            setId: state.setId
          )
        ) {
          Label("Mark set done", systemImage: "checkmark.circle.fill")
            .font(.subheadline.bold())
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.borderedProminent)
        .tint(Color("widgetAccent"))
      }
    }
    .padding()
    .activityBackgroundTint(Color(.systemBackground).opacity(0.8))
  }
}

// MARK: - Dynamic Island helpers

@ViewBuilder
private func expandedLeading(state: SweatyWorkoutAttributes.ContentState) -> some View {
  VStack(alignment: .leading, spacing: 2) {
    Text(state.exerciseName)
      .font(.caption.bold())
      .lineLimit(2)
      .minimumScaleFactor(0.8)
  }
  .padding(.leading, 4)
}

@ViewBuilder
private func expandedTrailing(state: SweatyWorkoutAttributes.ContentState) -> some View {
  Text(state.setDisplay)
    .font(.caption.bold())
    .multilineTextAlignment(.trailing)
    .padding(.trailing, 4)
}

@ViewBuilder
private func expandedBottom(state: SweatyWorkoutAttributes.ContentState) -> some View {
  HStack {
    if let restStartedAt = state.restStartedAt, let restEndsAt = state.restEndsAt {
      Label {
        Text(timerInterval: restStartedAt ... restEndsAt, countsDown: true)
          .font(.caption.monospacedDigit())
          .foregroundStyle(.orange)
      } icon: {
        Image(systemName: "timer")
          .foregroundStyle(.orange)
      }
      .font(.caption)
    } else {
      Text(timerInterval: state.workoutStartedAt ... .distantFuture, countsDown: false)
        .font(.caption.monospacedDigit())
        .foregroundStyle(.secondary)
    }

    Spacer()

    if #available(iOS 17.0, *) {
      Button(
        intent: MarkSetDoneIntent(
          exerciseId: state.exerciseId,
          setId: state.setId
        )
      ) {
        Image(systemName: "checkmark.circle.fill")
          .foregroundStyle(Color("widgetAccent"))
      }
      .buttonStyle(.plain)
    }
  }
  .padding(.horizontal, 4)
}

@ViewBuilder
private func compactTimer(state: SweatyWorkoutAttributes.ContentState) -> some View {
  if let restStartedAt = state.restStartedAt, let restEndsAt = state.restEndsAt {
    Text(timerInterval: restStartedAt ... restEndsAt, countsDown: true)
      .font(.caption2.monospacedDigit())
      .foregroundStyle(.orange)
  }
}
