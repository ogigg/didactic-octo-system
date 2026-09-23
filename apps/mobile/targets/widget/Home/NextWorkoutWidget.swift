import SwiftUI
import WidgetKit

struct NextWorkoutWidget: Widget {
  let kind = "NextWorkoutWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: HomeWidgetProvider()) { entry in
      NextWorkoutWidgetView(entry: entry)
    }
    .configurationDisplayName("widget.next.name")
    .description("widget.next.description")
    .supportedFamilies([
      .systemSmall,
      .systemMedium,
      .systemLarge,
      .accessoryRectangular,
      .accessoryCircular,
      .accessoryInline,
    ])
  }
}

struct NextWorkoutWidgetView: View {
  let entry: HomeWidgetEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    content
      .widgetURL(entry.url(whenReady: entry.snapshot?.next.deepLink))
      .homeWidgetSurface(family)
  }

  @ViewBuilder private var content: some View {
    if let snapshot = entry.snapshot, snapshot.isReady {
      let resolved = HomeWidgetResolved(snapshot: snapshot, now: entry.date)
      switch family {
      case .systemMedium: medium(resolved)
      case .systemLarge, .systemExtraLarge: large(resolved)
      case .accessoryRectangular: rectangular(snapshot.next)
      case .accessoryCircular: circular(snapshot.next)
      case .accessoryInline: Label(snapshot.next.inline, systemImage: "dumbbell.fill")
      default: small(snapshot.next)
      }
    } else {
      HomeWidgetStatusView(snapshot: entry.snapshot, family: family)
    }
  }

  // MARK: Home Screen

  private func small(_ next: HomeWidgetSnapshot.NextWorkout) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      HomeWidgetEyebrow(text: next.eyebrowShort)
      Text(next.title)
        .font(.system(size: 22, weight: .bold))
        .lineLimit(2)
        .minimumScaleFactor(0.75)
        .padding(.top, 8)
      if let focus = next.focus {
        Text(focus)
          .font(.system(size: 13))
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
      Spacer(minLength: 0)
      if let metaShort = next.metaShort {
        HStack(spacing: 6) {
          Image(systemName: "dumbbell.fill").font(.system(size: 11))
          Text(metaShort).monospacedDigit().lineLimit(1)
        }
        .font(.system(size: 12))
        .foregroundStyle(.secondary)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  private func header(_ resolved: HomeWidgetResolved, titleSize: CGFloat) -> some View {
    let next = resolved.snapshot.next
    return HStack(alignment: .top, spacing: 12) {
      VStack(alignment: .leading, spacing: 4) {
        HomeWidgetEyebrow(text: next.eyebrow)
        Text(next.title)
          .font(.system(size: titleSize, weight: .bold))
          .lineLimit(2)
          .minimumScaleFactor(0.8)
        if let meta = next.meta {
          Text(meta)
            .font(.system(size: 13))
            .foregroundStyle(.secondary)
            .monospacedDigit()
            .lineLimit(1)
        }
      }
      Spacer(minLength: 0)
      VStack(alignment: .trailing, spacing: 2) {
        Text(resolved.weekCompact.replacingOccurrences(of: "/", with: " / "))
          .font(.system(size: 20, weight: .bold))
          .monospacedDigit()
        Text(resolved.snapshot.week.thisWeekShort)
          .font(.system(size: 11))
          .foregroundStyle(.secondary)
      }
    }
  }

  private func footer(_ resolved: HomeWidgetResolved, pill: Bool) -> some View {
    let snapshot = resolved.snapshot
    return HStack {
      HomeWidgetStreakLabel(text: resolved.streak.displayInline)
      Spacer(minLength: 8)
      if pill {
        Text("\(snapshot.next.action) ›")
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(HomeWidgetPalette.accent)
          .padding(.horizontal, 12)
          .padding(.vertical, 6)
          .background(Capsule().fill(HomeWidgetPalette.track))
          .widgetAccentable()
      } else {
        Text("\(snapshot.next.actionShort) ›")
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(HomeWidgetPalette.accent)
          .widgetAccentable()
      }
    }
  }

  private func medium(_ resolved: HomeWidgetResolved) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      header(resolved, titleSize: 19)
      Spacer(minLength: 0)
      HomeWidgetHairline()
      footer(resolved, pill: false)
    }
  }

  private func large(_ resolved: HomeWidgetResolved) -> some View {
    let next = resolved.snapshot.next
    return VStack(alignment: .leading, spacing: 12) {
      header(resolved, titleSize: 22)
      HomeWidgetHairline()
      VStack(alignment: .leading, spacing: 6) {
        // Indexed by position: a workout can repeat the same exercise row.
        ForEach(Array(next.exercises.enumerated()), id: \.offset) { _, exercise in
          HStack(spacing: 12) {
            Text(exercise.name).lineLimit(1)
            Spacer(minLength: 0)
            Text(exercise.detail)
              .foregroundStyle(.secondary)
              .monospacedDigit()
              .lineLimit(1)
          }
          .font(.system(size: 13))
          .frame(height: 22)
        }
        if let more = next.moreExercises {
          Text(more)
            .font(.system(size: 12))
            .foregroundStyle(.secondary)
        }
      }
      Spacer(minLength: 0)
      HomeWidgetHairline()
      footer(resolved, pill: true)
    }
  }

  // MARK: Lock Screen

  private func rectangular(_ next: HomeWidgetSnapshot.NextWorkout) -> some View {
    VStack(alignment: .leading, spacing: 1) {
      HStack(spacing: 4) {
        Image(systemName: "dumbbell.fill").font(.system(size: 10, weight: .bold))
        Text(next.upNext)
          .font(.system(size: 11, weight: .bold))
          .textCase(.uppercase)
      }
      .foregroundStyle(.secondary)
      Text(next.title)
        .font(.system(size: 15, weight: .bold))
        .lineLimit(1)
        .minimumScaleFactor(0.8)
      if let metaShort = next.metaShort {
        Text(metaShort)
          .font(.system(size: 12))
          .foregroundStyle(.secondary)
          .monospacedDigit()
          .lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func circular(_ next: HomeWidgetSnapshot.NextWorkout) -> some View {
    ZStack {
      AccessoryWidgetBackground()
      VStack(spacing: 2) {
        Image(systemName: "dumbbell.fill").font(.system(size: 16, weight: .semibold))
        Text(next.shortTitle)
          .font(.system(size: 12, weight: .bold))
          .lineLimit(1)
          .minimumScaleFactor(0.6)
      }
      .padding(6)
    }
  }
}
