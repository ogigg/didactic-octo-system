import SwiftUI
import WidgetKit

struct StreakWeekWidget: Widget {
  let kind = "StreakWeekWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: HomeWidgetProvider()) { entry in
      StreakWeekWidgetView(entry: entry)
    }
    .configurationDisplayName("widget.streak.name")
    .description("widget.streak.description")
    .supportedFamilies([
      .systemSmall,
      .systemMedium,
      .accessoryCircular,
      .accessoryRectangular,
      .accessoryInline,
    ])
  }
}

struct StreakWeekWidgetView: View {
  let entry: HomeWidgetEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    // No deep link: the streak lives on home, and reopening the app where it
    // was avoids stacking a second home screen.
    content
      .homeWidgetSurface(family)
  }

  @ViewBuilder private var content: some View {
    if let snapshot = entry.snapshot, snapshot.isReady {
      let resolved = HomeWidgetResolved(snapshot: snapshot, now: entry.date)
      switch family {
      case .systemMedium: medium(resolved)
      case .accessoryCircular: circular(resolved)
      case .accessoryRectangular: rectangular(resolved)
      case .accessoryInline:
        Label("\(snapshot.streak.displayInline) · \(resolved.weekProgress)", systemImage: "flame.fill")
      default: small(resolved)
      }
    } else {
      HomeWidgetStatusView(snapshot: entry.snapshot, family: family, systemImage: "flame.fill")
    }
  }

  // MARK: Home Screen

  private func small(_ resolved: HomeWidgetResolved) -> some View {
    let streak = resolved.snapshot.streak
    return VStack(spacing: 0) {
      ZStack {
        HomeWidgetWeekRing(fraction: resolved.weekFraction, lineWidth: 11)
        VStack(spacing: 2) {
          HomeWidgetFlame(size: 14)
          Text("\(streak.weeks)")
            .font(.system(size: 26, weight: .bold))
            .monospacedDigit()
        }
      }
      .frame(width: 92, height: 92)
      Spacer(minLength: 0)
      Text(streak.displayTitle)
        .font(.system(size: 13, weight: .bold))
        .lineLimit(1)
        .minimumScaleFactor(0.8)
      Text("\(resolved.weekProgress) \(resolved.snapshot.week.thisWeekShort)")
        .font(.system(size: 12))
        .foregroundStyle(.secondary)
        .monospacedDigit()
        .lineLimit(1)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private func medium(_ resolved: HomeWidgetResolved) -> some View {
    let streak = resolved.snapshot.streak
    return HStack(spacing: 16) {
      ZStack {
        HomeWidgetWeekRing(fraction: resolved.weekFraction, lineWidth: 12)
        VStack(spacing: 2) {
          Text(resolved.weekCompact)
            .font(.system(size: 26, weight: .bold))
            .monospacedDigit()
          Text(resolved.snapshot.week.thisWeekShort)
            .font(.system(size: 11))
            .foregroundStyle(.secondary)
        }
      }
      .frame(width: 124, height: 124)

      VStack(alignment: .leading, spacing: 0) {
        HomeWidgetEyebrow(text: streak.label)
        HStack(alignment: .firstTextBaseline, spacing: 6) {
          HomeWidgetFlame(size: 18)
          Text("\(streak.weeks)")
            .font(.system(size: 34, weight: .bold))
            .monospacedDigit()
          Text(streak.unit)
            .font(.system(size: 15, weight: .semibold))
            .lineLimit(1)
        }
        .padding(.top, 6)
        Text(streak.longest)
          .font(.system(size: 13))
          .foregroundStyle(.secondary)
          .lineLimit(1)
          .padding(.top, 4)
        Spacer(minLength: 0)
        if let freezes = streak.freezes {
          HStack(spacing: 6) {
            Image(systemName: "snowflake").font(.system(size: 12))
            Text(freezes).lineLimit(1).minimumScaleFactor(0.8)
          }
          .font(.system(size: 12))
          .foregroundStyle(.secondary)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
  }

  // MARK: Lock Screen

  private func circular(_ resolved: HomeWidgetResolved) -> some View {
    Gauge(value: Double(min(resolved.weekDone, resolved.weekTarget)), in: 0...Double(resolved.weekTarget)) {
      EmptyView()
    } currentValueLabel: {
      VStack(spacing: 0) {
        Text(resolved.weekCompact)
          .font(.system(size: 15, weight: .bold))
          .monospacedDigit()
        Text(resolved.snapshot.week.ringCaptionShort)
          .font(.system(size: 11))
      }
    }
    .gaugeStyle(.accessoryCircularCapacity)
  }

  private func rectangular(_ resolved: HomeWidgetResolved) -> some View {
    let snapshot = resolved.snapshot
    let days = resolved.currentWeekDays
    return VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 4) {
        Image(systemName: "flame.fill").font(.system(size: 12, weight: .bold))
        Text("\(snapshot.streak.label) \(snapshot.streak.weeks) \(snapshot.streak.unitShort) · \(resolved.weekProgress)")
          .font(.system(size: 13, weight: .bold))
          .lineLimit(1)
          .minimumScaleFactor(0.8)
      }
      HStack(spacing: 0) {
        ForEach(Array(days.enumerated()), id: \.offset) { index, state in
          VStack(spacing: 3) {
            Text(index < snapshot.dayLetters.count ? snapshot.dayLetters[index] : "")
              .font(.system(size: 11, weight: state == .today || state == .todayTrained ? .bold : .regular))
              .foregroundStyle(.secondary)
            lockDot(state)
          }
          .frame(maxWidth: .infinity)
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  @ViewBuilder private func lockDot(_ state: HomeWidgetDayState) -> some View {
    switch state {
    case .trained:
      Circle().fill(Color.primary).frame(width: 10, height: 10)
    case .todayTrained:
      Circle().fill(Color.primary).frame(width: 10, height: 10)
        .overlay(Circle().stroke(Color.primary, lineWidth: 1.5).padding(-3))
    case .today:
      Circle().strokeBorder(Color.primary.opacity(0.5), lineWidth: 1.5).frame(width: 10, height: 10)
        .overlay(Circle().stroke(Color.primary, lineWidth: 1.5).padding(-3))
    case .rest:
      Circle().fill(Color.primary.opacity(0.28)).frame(width: 10, height: 10)
    case .future:
      Circle().strokeBorder(Color.primary.opacity(0.5), lineWidth: 1.5).frame(width: 10, height: 10)
    }
  }
}
