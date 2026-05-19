import { convertWeight, type WeightUnit } from "@/lib/unit-conversion";

export interface PreviousSetValue {
  setNumber: number;
  display: string;
}

export function formatPreviousWeightSet(
  loadKg: number | null | undefined,
  reps: number | null | undefined,
  unit: WeightUnit
): string | null {
  if (loadKg == null || reps == null) return null;

  const converted = Math.round(convertWeight(loadKg, unit) * 10) / 10;
  return `${converted}×${reps}`;
}

export function formatPreviousDurationSet(
  durationSeconds: number | null | undefined
): string | null {
  if (durationSeconds == null || durationSeconds <= 0) return null;

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

export function convertPreviousDisplay(
  display: string | null | undefined,
  unit: WeightUnit
): string | null {
  if (!display || unit === "kg") return display ?? null;

  const match = display.match(/^([\d.]+)(?:\s*kg)?\s*([×x])\s*([\d.]+)$/i);
  if (!match) return display;

  const kg = parseFloat(match[1]);
  if (!Number.isFinite(kg)) return display;

  const converted = Math.round(convertWeight(kg, unit) * 10) / 10;
  return `${converted}${match[2]}${match[3]}`;
}

export function parsePreviousWeightDisplay(
  display: string
): { load: string; reps: string } | null {
  const match = display.match(
    /^([\d.]+)(?:\s*(?:kg|lbs))?\s*[×x]\s*([\d.]+)$/i
  );

  if (!match) return null;

  return {
    load: match[1],
    reps: match[2],
  };
}
