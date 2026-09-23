import SwiftUI
import WidgetKit

struct TrainingTimeWidget: Widget {
  let kind = "TrainingTimeWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: HomeWidgetProvider()) { entry in
      TrainingTimeWidgetView(entry: entry)
    }
    .configurationDisplayName("widget.time.name")
    .description("widget.time.description")
    .supportedFamilies([.systemMedium, .systemLarge, .accessoryCircular])
  }
}

struct TrainingTimeWidgetView: View {
  let entry: HomeWidgetEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    content
      .widgetURL(entry.url(whenReady: "sweaty://statistics"))
      .homeWidgetSurface(family)
  }

  @ViewBuilder private var content: some View {
    if let snapshot = entry.snapshot, snapshot.isReady {
      let resolved = HomeWidgetResolved(snapshot: snapshot, now: entry.date)
      switch family {
      case .systemLarge, .systemExtraLarge: large(resolved)
      case .accessoryCircular: circular(resolved)
      default: medium(resolved)
      }
    } else {
      HomeWidgetStatusView(snapshot: entry.snapshot, family: family, systemImage: "chart.bar.fill")
    }
  }

  private func minutesLabel(_ resolved: HomeWidgetResolved) -> String {
    "\(resolved.thisWeekMinutes) \(resolved.snapshot.trainingTime.minutesUnit)"
  }

  private func medium(_ resolved: HomeWidgetResolved) -> some View {
    let time = resolved.snapshot.trainingTime
    return HStack(spacing: 16) {
      VStack(alignment: .leading, spacing: 0) {
        HomeWidgetEyebrow(text: time.window)
        Text(minutesLabel(resolved))
          .font(.system(size: 28, weight: .bold))
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.7)
          .padding(.top, 8)
        Text(time.thisWeek)
          .font(.system(size: 12))
          .foregroundStyle(.secondary)
        Spacer(minLength: 0)
        Text(time.average)
          .font(.system(size: 12))
          .foregroundStyle(.secondary)
          .monospacedDigit()
          .lineLimit(1)
      }
      .frame(width: 120, alignment: .leading)
      .frame(maxHeight: .infinity, alignment: .topLeading)

      HomeWidgetDurationBars(
        minutes: resolved.weeklyMinutes.map(\.minutes),
        maxHeight: 110,
        spacing: 8,
        cornerRadius: 3
      )
      .frame(maxHeight: .infinity, alignment: .bottom)
    }
  }

  private func large(_ resolved: HomeWidgetResolved) -> some View {
    let time = resolved.snapshot.trainingTime
    let weeks = resolved.weeklyMinutes
    return VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 4) {
          HomeWidgetEyebrow(text: time.label)
          Text(minutesLabel(resolved))
            .font(.system(size: 28, weight: .bold))
            .monospacedDigit()
          Text("\(time.thisWeek) · \(time.averageInline)")
            .font(.system(size: 12))
            .foregroundStyle(.secondary)
            .monospacedDigit()
            .lineLimit(1)
        }
        Spacer(minLength: 0)
        Text(time.weeksLabel)
          .font(.system(size: 12))
          .foregroundStyle(.secondary)
      }

      VStack(spacing: 6) {
        HomeWidgetDurationBars(
          minutes: weeks.map(\.minutes),
          maxHeight: 100,
          spacing: 10,
          cornerRadius: 4
        )
        HStack(spacing: 10) {
          ForEach(Array(weeks.enumerated()), id: \.offset) { _, week in
            Text(resolved.dayMonth(week.start))
              .font(.system(size: 11))
              .foregroundStyle(.secondary)
              .monospacedDigit()
              .lineLimit(1)
              .minimumScaleFactor(0.7)
              .frame(maxWidth: .infinity)
          }
        }
      }

      HomeWidgetHairline()
      HStack(alignment: .top, spacing: 12) {
        HomeWidgetMetric(value: time.totalHours, caption: time.totalCaption)
        HomeWidgetMetric(value: time.bestWeek, caption: time.bestWeekCaption)
        if let totalWorkouts = time.totalWorkouts {
          HomeWidgetMetric(value: "\(totalWorkouts)", caption: time.totalWorkoutsCaption)
        }
      }
      Spacer(minLength: 0)
      if let lastLine = resolved.lastWorkoutLine {
        HomeWidgetHairline()
        Text(lastLine)
          .font(.system(size: 13))
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
    }
  }

  private func circular(_ resolved: HomeWidgetResolved) -> some View {
    let average = Double(max(1, resolved.snapshot.trainingTime.averageMinutes))
    return Gauge(value: min(Double(resolved.thisWeekMinutes), average), in: 0...average) {
      EmptyView()
    } currentValueLabel: {
      VStack(spacing: 0) {
        Text("\(resolved.thisWeekMinutes)")
          .font(.system(size: 16, weight: .bold))
          .monospacedDigit()
        Text(resolved.snapshot.trainingTime.minutesUnit)
          .font(.system(size: 11))
      }
    }
    .gaugeStyle(.accessoryCircularCapacity)
  }
}
