import WidgetKit

struct HomeWidgetEntry: TimelineEntry {
  let date: Date
  let snapshot: HomeWidgetSnapshot?

  /// Opens `link` only when the snapshot has data. Otherwise a tap just brings
  /// the app forward where it was (usually sign-in or home), so it never stacks
  /// a second copy of that screen.
  func url(whenReady link: String?) -> URL? {
    guard snapshot?.isReady == true, let link else { return nil }
    return URL(string: link)
  }
}

/// Shared by all home widgets. The app pushes new data through
/// `WidgetCenter.reloadAllTimelines()`; the midnight entry keeps "today" and a
/// new week correct while the app stays closed.
struct HomeWidgetProvider: TimelineProvider {
  func placeholder(in context: Context) -> HomeWidgetEntry {
    HomeWidgetEntry(date: Date(), snapshot: HomeWidgetSample.snapshot())
  }

  func getSnapshot(in context: Context, completion: @escaping (HomeWidgetEntry) -> Void) {
    let now = Date()
    if context.isPreview {
      completion(HomeWidgetEntry(date: now, snapshot: HomeWidgetSample.snapshot(now: now)))
      return
    }
    completion(HomeWidgetEntry(date: now, snapshot: HomeWidgetStore.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<HomeWidgetEntry>) -> Void) {
    let now = Date()
    let snapshot = HomeWidgetStore.load()
    let midnight = HomeWidgetCalendar.nextMidnight(after: now)
    let entries = [
      HomeWidgetEntry(date: now, snapshot: snapshot),
      HomeWidgetEntry(date: midnight, snapshot: snapshot),
    ]
    completion(Timeline(entries: entries, policy: .after(midnight)))
  }
}
