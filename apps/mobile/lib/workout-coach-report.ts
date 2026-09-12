import type { PersonalRecord } from "@/lib/api/stats";
import type { WorkoutHistoryExportEntry } from "@/lib/api/workouts";
import {
  convertWeight,
  formatWeightWithSpace,
  type WeightUnit,
} from "@/lib/unit-conversion";
import {
  WORKOUT_EXPORT_PERIODS,
  type WorkoutExportFile,
  type WorkoutExportPeriod,
} from "@/lib/workout-history-export";

export interface CoachReportCopy {
  title: string;
  subtitle: string;
  generated: string;
  period: string;
  allTime: string;
  workouts: string;
  completedSets: string;
  totalVolume: string;
  trainingTime: string;
  averageRpe: string;
  completionRate: string;
  progressTitle: string;
  progressInsufficient: string;
  volumeIncreased: string;
  volumeDecreased: string;
  volumeSteady: string;
  weeklyTitle: string;
  weeklyEmpty: string;
  volumeTitle: string;
  personalRecordsTitle: string;
  personalRecordsSubtitle: string;
  personalRecordsEmpty: string;
  exercise: string;
  bestWeight: string;
  bestSetVolume: string;
  estimatedOneRepMax: string;
  recentWorkoutsTitle: string;
  date: string;
  workout: string;
  sets: string;
  volume: string;
  duration: string;
  minutes: string;
  sessions: string;
  footer: string;
}

interface WorkoutSummary {
  completedSets: number;
  date: Date;
  durationMinutes: number;
  name: string;
  volumeKg: number;
}

interface ReportTotals {
  averageRpe: number | null;
  completedSets: number;
  completionRate: number;
  durationMinutes: number;
  volumeKg: number;
}

export interface BuildCoachReportOptions {
  copy: CoachReportCopy;
  exportedAt: Date;
  locale: string;
  period: WorkoutExportPeriod;
  personalRecords: PersonalRecord[];
  unit: WeightUnit;
  workouts: WorkoutHistoryExportEntry[];
}

export function buildWorkoutCoachReportFile({
  copy,
  exportedAt,
  locale,
  period,
  personalRecords,
  unit,
  workouts,
}: BuildCoachReportOptions): WorkoutExportFile {
  const date = exportedAt.toISOString().slice(0, 10);
  const periodName = period === "all" ? "all" : `last-${period}`;
  const summaries = workouts
    .map(toWorkoutSummary)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const totals = getTotals(workouts);
  const html = buildHtml({
    copy,
    exportedAt,
    locale,
    period,
    personalRecords,
    summaries,
    totals,
    unit,
  });

  return {
    contents: html,
    mimeType: "application/pdf",
    name: `sweaty-coach-report-${periodName}-${date}.pdf`,
    uti: "com.adobe.pdf",
  };
}

function toWorkoutSummary(workout: WorkoutHistoryExportEntry): WorkoutSummary {
  const startedAt = workout.started_at ? new Date(workout.started_at) : null;
  const completedAt = workout.completed_at
    ? new Date(workout.completed_at)
    : null;
  let completedSets = 0;
  let volumeKg = 0;

  for (const exercise of workout.exercises) {
    for (const set of exercise.sets) {
      if (set.log?.completed) completedSets += 1;
      if (
        set.log?.completed &&
        set.log.actual_load_kg != null &&
        set.log.actual_reps != null
      ) {
        volumeKg += set.log.actual_load_kg * set.log.actual_reps;
      }
    }
  }

  const durationMs =
    startedAt && completedAt
      ? Math.max(0, completedAt.getTime() - startedAt.getTime())
      : 0;

  return {
    completedSets,
    date: completedAt ?? startedAt ?? new Date(workout.created_at),
    durationMinutes: Math.round(durationMs / 60_000),
    name: workout.name || "Workout",
    volumeKg,
  };
}

function getTotals(workouts: WorkoutHistoryExportEntry[]): ReportTotals {
  let completedSets = 0;
  let allSets = 0;
  let volumeKg = 0;
  let durationMinutes = 0;
  const rpes: number[] = [];

  for (const workout of workouts) {
    const summary = toWorkoutSummary(workout);
    completedSets += summary.completedSets;
    volumeKg += summary.volumeKg;
    durationMinutes += summary.durationMinutes;

    for (const exercise of workout.exercises) {
      for (const set of exercise.sets) {
        allSets += 1;
        if (set.log?.rpe != null) rpes.push(set.log.rpe);
      }
    }
  }

  return {
    averageRpe:
      rpes.length > 0
        ? rpes.reduce((sum, value) => sum + value, 0) / rpes.length
        : null,
    completedSets,
    completionRate: allSets > 0 ? (completedSets / allSets) * 100 : 0,
    durationMinutes,
    volumeKg,
  };
}

function buildHtml({
  copy,
  exportedAt,
  locale,
  period,
  personalRecords,
  summaries,
  totals,
  unit,
}: {
  copy: CoachReportCopy;
  exportedAt: Date;
  locale: string;
  period: WorkoutExportPeriod;
  personalRecords: PersonalRecord[];
  summaries: WorkoutSummary[];
  totals: ReportTotals;
  unit: WeightUnit;
}): string {
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const shortDateFormatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  });
  const numberFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  });
  const formatVolume = (kg: number) =>
    `${numberFormatter.format(convertWeight(kg, unit))} ${unit}`;
  const periodDays = WORKOUT_EXPORT_PERIODS[period];
  const periodLabel = periodDays === null ? copy.allTime : `${periodDays}`;
  const recentSummaries = summaries.slice(-8);
  const weeklyActivity = buildWeeklyActivity(summaries, exportedAt);
  const progress = buildProgressSummary(summaries, copy, numberFormatter);
  const maxWeekly = Math.max(1, ...weeklyActivity.map((week) => week.count));
  const maxVolume = Math.max(
    1,
    ...recentSummaries.map((item) => item.volumeKg)
  );
  const records = personalRecords
    .slice()
    .sort(
      (a, b) =>
        (b.est_1rm_kg ?? b.max_weight_kg) - (a.est_1rm_kg ?? a.max_weight_kg)
    )
    .slice(0, 10);

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #172033; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 10px; line-height: 1.35; }
    .hero { background: #10233f; border-radius: 14px; color: white; padding: 22px; margin-bottom: 14px; }
    .brand { color: #67d5ff; font-size: 10px; font-weight: 800; letter-spacing: 1.7px; text-transform: uppercase; }
    h1 { font-size: 26px; line-height: 1.05; margin: 8px 0 7px; }
    .subtitle { color: #cbd8e8; font-size: 11px; max-width: 420px; }
    .meta { color: #9fb1c8; margin-top: 13px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0 14px; }
    .card { border: 1px solid #dfe7f1; border-radius: 10px; padding: 10px; break-inside: avoid; }
    .card-label { color: #66758b; font-size: 8px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; }
    .card-value { color: #10233f; font-size: 18px; font-weight: 800; margin-top: 3px; }
    .progress { background: #e9f8ff; border-left: 4px solid #0ea5e9; border-radius: 8px; margin: 0 0 14px; padding: 11px 12px; break-inside: avoid; }
    .progress strong { color: #075985; display: block; margin-bottom: 3px; }
    h2 { color: #10233f; font-size: 14px; margin: 17px 0 8px; }
    .chart { border: 1px solid #dfe7f1; border-radius: 10px; padding: 11px; break-inside: avoid; }
    .bar-row { align-items: center; display: grid; gap: 8px; grid-template-columns: 64px 1fr 50px; margin: 6px 0; }
    .bar-label { color: #66758b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar-track { background: #edf2f7; border-radius: 99px; height: 8px; overflow: hidden; }
    .bar { background: #0ea5e9; border-radius: 99px; height: 100%; min-width: 2px; }
    .bar-value { color: #334155; font-size: 9px; text-align: right; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #f2f6fa; color: #526177; font-size: 8px; letter-spacing: .35px; padding: 7px 6px; text-align: left; text-transform: uppercase; }
    td { border-bottom: 1px solid #e7edf4; padding: 7px 6px; vertical-align: top; }
    tr { break-inside: avoid; }
    .numeric { text-align: right; white-space: nowrap; }
    .muted { color: #7b899c; }
    .empty { color: #7b899c; font-style: italic; padding: 8px 0; }
    footer { color: #8a97a8; font-size: 8px; margin-top: 18px; text-align: center; }
  </style>
</head>
<body>
  <section class="hero">
    <div class="brand">Sweaty</div>
    <h1>${escapeHtml(copy.title)}</h1>
    <div class="subtitle">${escapeHtml(copy.subtitle)}</div>
    <div class="meta">${escapeHtml(copy.period)}: ${escapeHtml(periodLabel)} · ${escapeHtml(copy.generated)}: ${escapeHtml(dateFormatter.format(exportedAt))}</div>
  </section>

  <section class="grid">
    ${metricCard(copy.workouts, String(summaries.length))}
    ${metricCard(copy.completedSets, String(totals.completedSets))}
    ${metricCard(copy.totalVolume, formatVolume(totals.volumeKg))}
    ${metricCard(copy.trainingTime, `${numberFormatter.format(totals.durationMinutes)} ${copy.minutes}`)}
    ${metricCard(copy.averageRpe, totals.averageRpe == null ? "—" : numberFormatter.format(totals.averageRpe))}
    ${metricCard(copy.completionRate, `${Math.round(totals.completionRate)}%`)}
  </section>

  <section class="progress">
    <strong>${escapeHtml(copy.progressTitle)}</strong>
    ${escapeHtml(progress)}
  </section>

  <h2>${escapeHtml(copy.weeklyTitle)}</h2>
  <section class="chart">
    ${weeklyActivity.length === 0 ? `<div class="empty">${escapeHtml(copy.weeklyEmpty)}</div>` : weeklyActivity.map((week) => chartRow(shortDateFormatter.format(week.start), week.count / maxWeekly, `${week.count} ${copy.sessions}`)).join("")}
  </section>

  <h2>${escapeHtml(copy.volumeTitle)}</h2>
  <section class="chart">
    ${recentSummaries.map((workout) => chartRow(shortDateFormatter.format(workout.date), workout.volumeKg / maxVolume, formatVolume(workout.volumeKg))).join("")}
  </section>

  <h2>${escapeHtml(copy.personalRecordsTitle)}</h2>
  <div class="muted">${escapeHtml(copy.personalRecordsSubtitle)}</div>
  ${
    records.length === 0
      ? `<div class="empty">${escapeHtml(copy.personalRecordsEmpty)}</div>`
      : `
  <table>
    <thead><tr><th>${escapeHtml(copy.exercise)}</th><th class="numeric">${escapeHtml(copy.bestWeight)}</th><th class="numeric">${escapeHtml(copy.bestSetVolume)}</th><th class="numeric">${escapeHtml(copy.estimatedOneRepMax)}</th></tr></thead>
    <tbody>${records.map((record) => `<tr><td>${escapeHtml(record.exercise_name)}</td><td class="numeric">${escapeHtml(formatWeightWithSpace(record.max_weight_kg, unit))}${record.max_weight_reps ? ` × ${record.max_weight_reps}` : ""}</td><td class="numeric">${escapeHtml(formatVolume(record.max_volume_set_kg))}</td><td class="numeric">${record.est_1rm_kg == null ? "—" : escapeHtml(formatWeightWithSpace(record.est_1rm_kg, unit))}</td></tr>`).join("")}</tbody>
  </table>`
  }

  <h2>${escapeHtml(copy.recentWorkoutsTitle)}</h2>
  <table>
    <thead><tr><th>${escapeHtml(copy.date)}</th><th>${escapeHtml(copy.workout)}</th><th class="numeric">${escapeHtml(copy.sets)}</th><th class="numeric">${escapeHtml(copy.volume)}</th><th class="numeric">${escapeHtml(copy.duration)}</th></tr></thead>
    <tbody>${recentSummaries
      .slice()
      .reverse()
      .map(
        (workout) =>
          `<tr><td>${escapeHtml(shortDateFormatter.format(workout.date))}</td><td>${escapeHtml(workout.name)}</td><td class="numeric">${workout.completedSets}</td><td class="numeric">${escapeHtml(formatVolume(workout.volumeKg))}</td><td class="numeric">${workout.durationMinutes} ${escapeHtml(copy.minutes)}</td></tr>`
      )
      .join("")}</tbody>
  </table>

  <footer>${escapeHtml(copy.footer)}</footer>
</body>
</html>`;
}

function buildWeeklyActivity(summaries: WorkoutSummary[], now: Date) {
  const startOfCurrentWeek = startOfWeek(now);
  return Array.from({ length: 8 }, (_, index) => {
    const start = new Date(startOfCurrentWeek);
    start.setDate(start.getDate() - (7 - index) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return {
      count: summaries.filter(
        (summary) => summary.date >= start && summary.date < end
      ).length,
      start,
    };
  });
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function buildProgressSummary(
  summaries: WorkoutSummary[],
  copy: CoachReportCopy,
  numberFormatter: Intl.NumberFormat
): string {
  if (summaries.length < 4) return copy.progressInsufficient;

  const midpoint = Math.floor(summaries.length / 2);
  const earlier = summaries.slice(0, midpoint);
  const recent = summaries.slice(midpoint);
  const earlierAverage = average(earlier.map((item) => item.volumeKg));
  const recentAverage = average(recent.map((item) => item.volumeKg));

  if (earlierAverage === 0) return copy.progressInsufficient;

  const change = ((recentAverage - earlierAverage) / earlierAverage) * 100;
  if (Math.abs(change) < 2) return copy.volumeSteady;

  const template = change > 0 ? copy.volumeIncreased : copy.volumeDecreased;
  return template.replace(
    "{{percent}}",
    numberFormatter.format(Math.abs(change))
  );
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function metricCard(label: string, value: string): string {
  return `<div class="card"><div class="card-label">${escapeHtml(label)}</div><div class="card-value">${escapeHtml(value)}</div></div>`;
}

function chartRow(label: string, ratio: number, value: string): string {
  const width = Math.max(0, Math.min(100, ratio * 100));
  return `<div class="bar-row"><div class="bar-label">${escapeHtml(label)}</div><div class="bar-track"><div class="bar" style="width:${width}%"></div></div><div class="bar-value">${escapeHtml(value)}</div></div>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
