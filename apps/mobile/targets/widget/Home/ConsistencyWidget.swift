import SwiftUI
import WidgetKit

struct ConsistencyWidget: Widget {
  let kind = "ConsistencyWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: HomeWidgetProvider()) { entry in
      ConsistencyWidgetView(entry: entry)
    }
    .configurationDisplayName("widget.consistency.name")
    .description("widget.consistency.description")
    .supportedFamilies([.systemMedium, .systemLarge, .accessoryCircular])
  }
}

struct ConsistencyWidgetView: View {
  let entry: HomeWidgetEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    content
      .widgetURL(entry.url(whenReady: "sweaty://history"))
      .homeWidgetSurface(family)
  }

  @ViewBuilder private var content: some View {
    if let snapshot = entry.snapshot, snapshot.isReady {
      let resolved = HomeWidgetResolved(snapshot: snapshot, now: entry.date)
      switch family {
      case .systemLarge, .systemExtraLarge: large(resolved)
      case .accessoryCircular: circular(resolved.streak)
      default: medium(resolved)
      }
    } else {
      HomeWidgetStatusView(snapshot: entry.snapshot, family: family, systemImage: "square.grid.3x3.fill")
    }
  }

  private func medium(_ resolved: HomeWidgetResolved) -> some View {
    let stats = resolved.consistencyStats
    return HStack(spacing: 16) {
      VStack(alignment: .leading, spacing: 0) {
        HomeWidgetEyebrow(text: resolved.snapshot.consistency.windowShort)
        HStack(alignment: .firstTextBaseline, spacing: 6) {
          Text("\(stats.sessionsShort)")
            .font(.system(size: 32, weight: .bold))
            .monospacedDigit()
          Text(stats.sessionsShortUnit)
            .font(.system(size: 15, weight: .semibold))
            .lineLimit(1)
        }
        .padding(.top, 6)
        Text(stats.averageShort)
          .font(.system(size: 12))
          .foregroundStyle(.secondary)
          .lineLimit(2)
          .padding(.top, 4)
        Spacer(minLength: 0)
        HomeWidgetStreakLabel(text: resolved.streak.displayInline)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

      HomeWidgetActivityGrid(weeks: resolved.grid(weeks: 8), cellSize: 10, spacing: 6, cornerRadius: 3)
    }
  }

  private func large(_ resolved: HomeWidgetResolved) -> some View {
    let snapshot = resolved.snapshot
    let consistency = snapshot.consistency
    let stats = resolved.consistencyStats
    let weeks = resolved.grid(weeks: 12)
    return VStack(alignment: .leading, spacing: 14) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 2) {
          HomeWidgetEyebrow(text: consistency.label)
          HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text("\(stats.sessionsLong)")
              .font(.system(size: 30, weight: .bold))
              .monospacedDigit()
            Text(stats.sessionsLongUnit)
              .font(.system(size: 15, weight: .semibold))
          }
          Text(consistency.inLastWeeks)
            .font(.system(size: 13))
            .foregroundStyle(.secondary)
        }
        Spacer(minLength: 0)
        Text(consistency.weeksLong)
          .font(.system(size: 12))
          .foregroundStyle(.secondary)
      }

      VStack(alignment: .leading, spacing: 6) {
        HStack(alignment: .top, spacing: 8) {
          VStack(spacing: 6) {
            ForEach(Array(snapshot.dayLetters.enumerated()), id: \.offset) { _, letter in
              Text(letter)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .frame(width: 12, height: 14)
            }
          }
          HomeWidgetActivityGrid(weeks: weeks, cellSize: 14, spacing: 6, cornerRadius: 4)
        }
        HStack {
          Text(weeks.first.map { resolved.dayMonth($0.start) } ?? "")
          Spacer(minLength: 0)
          Text(weeks.last.map { resolved.dayMonth($0.start) } ?? "")
        }
        .font(.system(size: 11))
        .foregroundStyle(.secondary)
        .monospacedDigit()
        .padding(.leading, 20)
        .frame(width: 20 + 12 * 14 + 11 * 6)
      }

      HomeWidgetHairline()
      HStack(alignment: .top, spacing: 12) {
        HomeWidgetMetric(value: stats.averageLongValue, caption: consistency.averageLongCaption)
        HomeWidgetMetric(value: stats.currentStreakValue, caption: consistency.currentStreakCaption)
        HomeWidgetMetric(value: stats.longestStreakValue, caption: consistency.longestStreakCaption)
      }
      Spacer(minLength: 0)
    }
  }

  private func circular(_ streak: HomeWidgetSnapshot.Streak) -> some View {
    ZStack {
      AccessoryWidgetBackground()
      // Sized to stay inside the circle; the top and bottom rows sit where it
      // is narrowest.
      VStack(spacing: 0) {
        Image(systemName: "flame.fill").font(.system(size: 11, weight: .semibold))
        Text("\(streak.weeks)")
          .font(.system(size: 17, weight: .bold))
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.7)
        Text(streak.unitShort)
          .font(.system(size: 11))
          .lineLimit(1)
      }
    }
  }
}
