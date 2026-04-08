export type MeasurementField =
  | "weight_kg"
  | "body_fat_pct"
  | "muscle_mass_kg"
  | "chest_cm"
  | "waist_cm"
  | "hips_cm"
  | "neck_cm"
  | "shoulders_cm"
  | "biceps_left_cm"
  | "biceps_right_cm"
  | "forearm_left_cm"
  | "forearm_right_cm"
  | "thigh_left_cm"
  | "thigh_right_cm"
  | "calf_left_cm"
  | "calf_right_cm";

export type MeasurementUnit = "kg" | "%" | "cm";

export interface MeasurementGroup {
  key: "bodyComposition" | "upperBody" | "lowerBody";
  fields: MeasurementField[];
}

export const MEASUREMENT_FIELDS: MeasurementField[] = [
  "weight_kg",
  "body_fat_pct",
  "muscle_mass_kg",
  "chest_cm",
  "waist_cm",
  "hips_cm",
  "neck_cm",
  "shoulders_cm",
  "biceps_left_cm",
  "biceps_right_cm",
  "forearm_left_cm",
  "forearm_right_cm",
  "thigh_left_cm",
  "thigh_right_cm",
  "calf_left_cm",
  "calf_right_cm",
];

export function getMeasurementUnit(field: MeasurementField): MeasurementUnit {
  if (field === "weight_kg" || field === "muscle_mass_kg") return "kg";
  if (field === "body_fat_pct") return "%";
  return "cm";
}

export const MEASUREMENT_GROUPS: MeasurementGroup[] = [
  {
    key: "bodyComposition",
    fields: ["weight_kg", "body_fat_pct", "muscle_mass_kg"],
  },
  {
    key: "upperBody",
    fields: [
      "chest_cm",
      "waist_cm",
      "hips_cm",
      "neck_cm",
      "shoulders_cm",
      "biceps_left_cm",
      "biceps_right_cm",
      "forearm_left_cm",
      "forearm_right_cm",
    ],
  },
  {
    key: "lowerBody",
    fields: [
      "thigh_left_cm",
      "thigh_right_cm",
      "calf_left_cm",
      "calf_right_cm",
    ],
  },
];

export const DEFAULT_FIELD: MeasurementField = "weight_kg";
