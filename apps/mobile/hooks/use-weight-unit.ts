import { useProfile } from "@/hooks/use-profile-query";
import {
  convertWeight,
  toKg,
  formatWeight,
  formatWeightWithSpace,
  formatVolume,
  weightUnitLabel,
  distanceUnitLabel,
  convertDistance,
  toCm,
  type WeightUnit,
} from "@/lib/unit-conversion";
import { useMemo } from "react";

/**
 * Reads the user's weight_unit preference from their profile
 * and returns the unit plus convenience conversion helpers.
 *
 * Falls back to 'kg' while the profile is loading.
 */
export function useWeightUnit() {
  const { data: profile } = useProfile();
  const unit: WeightUnit = profile?.weight_unit ?? "kg";

  return useMemo(
    () => ({
      unit,
      /** Unit label: "kg" or "lbs" */
      label: weightUnitLabel(unit),
      /** Distance unit label: "cm" or "in" */
      distanceLabel: distanceUnitLabel(unit),
      /** Convert a kg value to the user's display unit (numeric) */
      convert: (kg: number) => convertWeight(kg, unit),
      /** Convert a user-entered value back to kg for storage */
      toKg: (value: number) => toKg(value, unit),
      /** Format kg as "80kg" or "176.4lbs" */
      format: (kg: number) => formatWeight(kg, unit),
      /** Format kg as "80 kg" or "176.4 lbs" */
      formatSpaced: (kg: number) => formatWeightWithSpace(kg, unit),
      /** Format volume (large kg totals) as "1.2t" or "2,645lbs" */
      formatVolume: (kg: number) => formatVolume(kg, unit),
      /** Convert cm to display distance unit (numeric) */
      convertDistance: (cm: number) => convertDistance(cm, unit),
      /** Convert user-entered distance back to cm */
      toCm: (value: number) => toCm(value, unit),
    }),
    [unit]
  );
}
