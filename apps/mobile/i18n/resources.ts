import { auth } from "./locales/en/auth";
import { common } from "./locales/en/common";
import { home } from "./locales/en/home";
import { profile } from "./locales/en/profile";
import { modal } from "./locales/en/modal";
import { designSystem } from "./locales/en/design-system";
import { workout } from "./locales/en/workout";
import { exercisePicker } from "./locales/en/exercise-picker";
import { generateWorkout } from "./locales/en/generate-workout";
import { history } from "./locales/en/history";
import { calendar } from "./locales/en/calendar";
import { stats } from "./locales/en/stats";
import { workoutPreview } from "./locales/en/workout-preview";
import { trainingPreferences } from "./locales/en/training-preferences";
import { strengthBaselines } from "./locales/en/strength-baselines";
import { exerciseDetail } from "./locales/en/exercise-detail";
import { exercisePreference } from "./locales/en/exercise-preference";
import { measurements } from "./locales/en/measurements";
import { feedback } from "./locales/en/feedback";
import { subscription } from "./locales/en/subscription";
import { healthSync } from "./locales/en/health-sync";

export const resources = {
  en: {
    auth,
    common,
    home,
    profile,
    calendar,
    modal,
    designSystem,
    workout,
    exercisePicker,
    generateWorkout,
    history,
    stats,
    workoutPreview,
    trainingPreferences,
    strengthBaselines,
    exerciseDetail,
    exercisePreference,
    measurements,
    feedback,
    subscription,
    healthSync,
  },
} as const;

export type AppResources = (typeof resources)["en"];
