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
          expandedLeading()
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
        compactSetProgress(state: context.state)
      } minimal: {
        compactSetProgress(state: context.state)
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

      if #available(iOS 18.0, *) {
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

// MARK: - Dynamic Island — compact / minimal

@ViewBuilder
private func compactSetProgress(state: SweatyWorkoutAttributes.ContentState) -> some View {
  Text("\(state.currentSetNumber)/\(state.totalSets)")
    .font(.caption2.monospacedDigit())
    .foregroundStyle(.primary)
}

// MARK: - Dynamic Island — expanded top row

@ViewBuilder
private func expandedLeading() -> some View {
  Text(resolvedAppDisplayName())
    .font(.caption.bold())
    .lineLimit(1)
    .minimumScaleFactor(0.85)
    .padding(.leading, 4)
}

@ViewBuilder
private func expandedTrailing(state: SweatyWorkoutAttributes.ContentState) -> some View {
  Text(timerInterval: state.workoutStartedAt ... .distantFuture, countsDown: false)
    .font(.caption.monospacedDigit())
    .foregroundStyle(.secondary)
    .padding(.trailing, 4)
}

// MARK: - Dynamic Island — expanded bottom

@ViewBuilder
private func expandedBottom(state: SweatyWorkoutAttributes.ContentState) -> some View {
  let title = state.workoutName.trimmingCharacters(in: .whitespacesAndNewlines)
  VStack(alignment: .leading, spacing: 8) {
    Text(title.isEmpty ? "Workout" : title)
      .font(.subheadline.weight(.semibold))
      .foregroundStyle(.primary)
      .lineLimit(2)
      .minimumScaleFactor(0.85)
      .frame(maxWidth: .infinity, alignment: .leading)

    HStack(alignment: .center, spacing: 8) {
      Text(state.proposalDisplay)
        .font(.body.weight(.medium))
        .multilineTextAlignment(.leading)
        .lineLimit(2)
        .minimumScaleFactor(0.8)

      Spacer(minLength: 8)

      if #available(iOS 18.0, *) {
        Button(
          intent: MarkSetDoneIntent(
            exerciseId: state.exerciseId,
            setId: state.setId
          )
        ) {
          Image(systemName: "checkmark.circle.fill")
            .font(.title3)
            .foregroundStyle(Color("widgetAccent"))
        }
        .buttonStyle(.plain)
      }
    }
  }
  .padding(.horizontal, 4)
}

private func resolvedAppDisplayName() -> String {
  let display = Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String
  let bundleName = Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String
  let raw = [display, bundleName]
    .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
    .first { !$0.isEmpty }
  if let raw, !raw.isEmpty, raw != "mobile" {
    return raw
  }
  return "Sweaty"
}
