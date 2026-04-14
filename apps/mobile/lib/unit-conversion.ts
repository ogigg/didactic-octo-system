import { getLocales } from "expo-localization";

// ─── Types ──────────────────────────────────────────────────────────────────

export type WeightUnit = "kg" | "lbs";

// ─── Constants ──────────────────────────────────────────────────────────────

const KG_TO_LBS = 2.20462;
const CM_TO_IN = 0.393701;

// ─── Conversion functions ───────────────────────────────────────────────────

export function kgToLbs(kg: number): number {
  return kg * KG_TO_LBS;
}

export function lbsToKg(lbs: number): number {
  return lbs / KG_TO_LBS;
}

export function cmToIn(cm: number): number {
  return cm * CM_TO_IN;
}

export function inToCm(inches: number): number {
  return inches / CM_TO_IN;
}

// ─── Display helpers ────────────────────────────────────────────────────────

/**
 * Convert a kg value to the user's preferred unit.
 * Returns the numeric value (not formatted).
 */
export function convertWeight(kg: number, unit: WeightUnit): number {
  return unit === "lbs" ? kgToLbs(kg) : kg;
}

/**
 * Convert a user-entered weight back to kg for storage.
 */
export function toKg(value: number, unit: WeightUnit): number {
  return unit === "lbs" ? lbsToKg(value) : value;
}

/**
 * Format a weight value for display.
 * Rounds to 1 decimal, drops trailing .0.
 */
export function formatWeight(kg: number, unit: WeightUnit): string {
  const converted = convertWeight(kg, unit);
  const rounded = Math.round(converted * 10) / 10;
  const display = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1);
  return `${display}${unit === "lbs" ? "lbs" : "kg"}`;
}

/**
 * Format a weight value with a space before the unit (e.g. "80 kg").
 */
export function formatWeightWithSpace(kg: number, unit: WeightUnit): string {
  const converted = convertWeight(kg, unit);
  const rounded = Math.round(converted * 10) / 10;
  const display = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1);
  return `${display} ${unit === "lbs" ? "lbs" : "kg"}`;
}

/**
 * Get just the unit label string.
 */
export function weightUnitLabel(unit: WeightUnit): string {
  return unit === "lbs" ? "lbs" : "kg";
}

/**
 * Convert a cm value for display based on weight unit preference.
 * Imperial users see inches, metric users see cm.
 */
export function convertDistance(cm: number, unit: WeightUnit): number {
  return unit === "lbs" ? cmToIn(cm) : cm;
}

/**
 * Get the distance unit label based on weight unit preference.
 */
export function distanceUnitLabel(unit: WeightUnit): string {
  return unit === "lbs" ? "in" : "cm";
}

/**
 * Convert a user-entered distance back to cm for storage.
 */
export function toCm(value: number, unit: WeightUnit): number {
  return unit === "lbs" ? inToCm(value) : value;
}

// ─── Format volume (large kg values) ────────────────────────────────────────

/**
 * Format a volume value (total kg lifted) for display.
 * Handles tonnes/tons abbreviation for large values.
 */
export function formatVolume(kg: number, unit: WeightUnit): string {
  const converted = convertWeight(kg, unit);
  if (unit === "lbs") {
    if (converted >= 2000) {
      const t = Math.round((converted / 2000) * 10) / 10;
      return `${t}t`;
    }
    return `${Math.round(converted)}lbs`;
  }
  if (converted >= 1000) {
    const t = Math.round((converted / 1000) * 10) / 10;
    return `${t}t`;
  }
  return `${Math.round(converted)}kg`;
}

// ─── Locale detection ───────────────────────────────────────────────────────

/** Countries that use imperial units for body weight / gym loads. */
const IMPERIAL_REGIONS = new Set(["US", "LR", "MM"]);

/**
 * Detect the best default weight unit from the device locale.
 * Falls back to 'kg' when detection fails.
 */
export function detectDefaultWeightUnit(): WeightUnit {
  try {
    const locales = getLocales();
    const region = locales[0]?.regionCode;
    if (region && IMPERIAL_REGIONS.has(region)) {
      return "lbs";
    }
  } catch {
    // expo-localization not available (e.g. tests) — fall back to kg
  }
  return "kg";
}
