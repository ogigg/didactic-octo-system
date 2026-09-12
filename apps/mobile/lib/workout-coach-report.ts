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
  completionTitle: string;
  completedLabel: string;
  incompleteLabel: string;
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
  totalSets: number;
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
    totalSets: allSets,
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
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; color: #172033; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 10px; line-height: 1.35; }
    .hero { border: 2px solid #10233f; border-left: 8px solid #0ea5e9; border-radius: 14px; color: #10233f; padding: 20px; margin-bottom: 14px; }
    .brand { color: #0785bd; font-size: 10px; font-weight: 800; letter-spacing: 1.7px; text-transform: uppercase; }
    h1 { font-size: 26px; line-height: 1.05; margin: 8px 0 7px; }
    .subtitle { color: #526177; font-size: 11px; max-width: 420px; }
    .meta { color: #66758b; margin-top: 13px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0 14px; }
    .card { border: 1px solid #dfe7f1; border-radius: 10px; padding: 10px; break-inside: avoid; }
    .card-label { color: #66758b; font-size: 8px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; }
    .card-value { color: #10233f; font-size: 18px; font-weight: 800; margin-top: 3px; }
    .progress { background: #e9f8ff; border-left: 4px solid #0ea5e9; border-radius: 8px; margin: 0 0 14px; padding: 11px 12px; break-inside: avoid; }
    .progress strong { color: #075985; display: block; margin-bottom: 3px; }
    h2 { color: #10233f; font-size: 14px; margin: 17px 0 8px; }
    .chart { border: 1px solid #dfe7f1; border-radius: 10px; padding: 11px; break-inside: avoid; }
    .chart svg { display: block; height: auto; width: 100%; }
    .chart-row { display: flex; gap: 10px; margin-top: 14px; break-inside: avoid; }
    .chart-row > section { flex: 1; }
    .chart-row h2 { margin-top: 0; }
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
    ${weeklyActivity.length === 0 ? `<div class="empty">${escapeHtml(copy.weeklyEmpty)}</div>` : weeklyBarChart(weeklyActivity, shortDateFormatter, copy.sessions)}
  </section>

  <div class="chart-row">
    <section>
      <h2>${escapeHtml(copy.volumeTitle)}</h2>
      <div class="chart">${volumeLineChart(recentSummaries, shortDateFormatter, formatVolume)}</div>
    </section>
    <section>
      <h2>${escapeHtml(copy.completionTitle)}</h2>
      <div class="chart">${completionDonutChart(totals, copy)}</div>
    </section>
  </div>

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

function weeklyBarChart(
  weeks: { count: number; start: Date }[],
  dateFormatter: Intl.DateTimeFormat,
  sessionsLabel: string
): string {
  const width = 680;
  const height = 190;
  const chartTop = 18;
  const chartHeight = 125;
  const barWidth = 52;
  const gap = 24;
  const max = Math.max(1, ...weeks.map((week) => week.count));
  const bars = weeks
    .map((week, index) => {
      const x = 30 + index * (barWidth + gap);
      const barHeight = (week.count / max) * chartHeight;
      const y = chartTop + chartHeight - barHeight;
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="#0ea5e9" />
        <text x="${x + barWidth / 2}" y="${Math.max(12, y - 5)}" text-anchor="middle" fill="#334155" font-size="10" font-weight="700">${week.count}</text>
        <text x="${x + barWidth / 2}" y="163" text-anchor="middle" fill="#66758b" font-size="9">${escapeHtml(dateFormatter.format(week.start))}</text>`;
    })
    .join("");

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(sessionsLabel)}">
    <line x1="20" y1="143" x2="660" y2="143" stroke="#cbd5e1" stroke-width="1" />
    <line x1="20" y1="80" x2="660" y2="80" stroke="#e7edf4" stroke-width="1" stroke-dasharray="4 4" />
    ${bars}
  </svg>`;
}

function volumeLineChart(
  workouts: WorkoutSummary[],
  dateFormatter: Intl.DateTimeFormat,
  formatVolume: (kg: number) => string
): string {
  const width = 330;
  const height = 190;
  const left = 22;
  const top = 20;
  const chartWidth = 286;
  const chartHeight = 115;
  const max = Math.max(1, ...workouts.map((workout) => workout.volumeKg));
  const points = workouts.map((workout, index) => {
    const x =
      workouts.length === 1
        ? left + chartWidth / 2
        : left + (index / (workouts.length - 1)) * chartWidth;
    const y = top + chartHeight - (workout.volumeKg / max) * chartHeight;
    return { workout, x, y };
  });

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(formatVolume(max))}">
    <line x1="${left}" y1="${top + chartHeight}" x2="${left + chartWidth}" y2="${top + chartHeight}" stroke="#cbd5e1" />
    <line x1="${left}" y1="${top + chartHeight / 2}" x2="${left + chartWidth}" y2="${top + chartHeight / 2}" stroke="#e7edf4" stroke-dasharray="4 4" />
    ${points.length > 1 ? `<polyline points="${points.map(({ x, y }) => `${x},${y}`).join(" ")}" fill="none" stroke="#0ea5e9" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" />` : ""}
    ${points
      .map(
        ({ workout, x, y }, index) =>
          `<circle cx="${x}" cy="${y}" r="5" fill="#0ea5e9" stroke="#ffffff" stroke-width="2" />
      ${index === points.length - 1 ? `<text x="${x}" y="${Math.max(11, y - 9)}" text-anchor="end" fill="#334155" font-size="8" font-weight="700">${escapeHtml(formatVolume(workout.volumeKg))}</text>` : ""}
      ${index === 0 || index === Math.floor(points.length / 2) || index === points.length - 1 ? `<text x="${x}" y="158" text-anchor="${index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}" fill="#66758b" font-size="8">${escapeHtml(dateFormatter.format(workout.date))}</text>` : ""}`
      )
      .join("")}
  </svg>`;
}

function completionDonutChart(
  totals: ReportTotals,
  copy: CoachReportCopy
): string {
  const radius = 51;
  const circumference = 2 * Math.PI * radius;
  const completedRatio = totals.totalSets
    ? totals.completedSets / totals.totalSets
    : 0;
  const dash = completedRatio * circumference;
  const incompleteSets = totals.totalSets - totals.completedSets;

  return `<svg viewBox="0 0 330 190" role="img" aria-label="${Math.round(totals.completionRate)}%">
    <circle cx="90" cy="94" r="${radius}" fill="none" stroke="#e7edf4" stroke-width="18" />
    <circle cx="90" cy="94" r="${radius}" fill="none" stroke="#0ea5e9" stroke-width="18" stroke-dasharray="${dash} ${circumference - dash}" stroke-linecap="round" transform="rotate(-90 90 94)" />
    <text x="90" y="91" text-anchor="middle" fill="#10233f" font-size="22" font-weight="800">${Math.round(totals.completionRate)}%</text>
    <text x="90" y="108" text-anchor="middle" fill="#66758b" font-size="8">${escapeHtml(copy.completionRate)}</text>
    <circle cx="180" cy="72" r="5" fill="#0ea5e9" />
    <text x="193" y="76" fill="#334155" font-size="10">${escapeHtml(copy.completedLabel)}: ${totals.completedSets}</text>
    <circle cx="180" cy="107" r="5" fill="#e7edf4" stroke="#cbd5e1" />
    <text x="193" y="111" fill="#334155" font-size="10">${escapeHtml(copy.incompleteLabel)}: ${incompleteSets}</text>
  </svg>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
