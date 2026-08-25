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
import { deleteAccount } from "./locales/en/delete-account";
import { accountSettings } from "./locales/en/account-settings";
import { streakProtection } from "./locales/en/streak-protection";
import { auth as authPl } from "./locales/pl/auth";
import { common as commonPl } from "./locales/pl/common";
import { home as homePl } from "./locales/pl/home";
import { profile as profilePl } from "./locales/pl/profile";
import { modal as modalPl } from "./locales/pl/modal";
import { designSystem as designSystemPl } from "./locales/pl/design-system";
import { workout as workoutPl } from "./locales/pl/workout";
import { exercisePicker as exercisePickerPl } from "./locales/pl/exercise-picker";
import { generateWorkout as generateWorkoutPl } from "./locales/pl/generate-workout";
import { history as historyPl } from "./locales/pl/history";
import { calendar as calendarPl } from "./locales/pl/calendar";
import { stats as statsPl } from "./locales/pl/stats";
import { workoutPreview as workoutPreviewPl } from "./locales/pl/workout-preview";
import { trainingPreferences as trainingPreferencesPl } from "./locales/pl/training-preferences";
import { strengthBaselines as strengthBaselinesPl } from "./locales/pl/strength-baselines";
import { exerciseDetail as exerciseDetailPl } from "./locales/pl/exercise-detail";
import { exercisePreference as exercisePreferencePl } from "./locales/pl/exercise-preference";
import { measurements as measurementsPl } from "./locales/pl/measurements";
import { feedback as feedbackPl } from "./locales/pl/feedback";
import { subscription as subscriptionPl } from "./locales/pl/subscription";
import { healthSync as healthSyncPl } from "./locales/pl/health-sync";
import { deleteAccount as deleteAccountPl } from "./locales/pl/delete-account";
import { accountSettings as accountSettingsPl } from "./locales/pl/account-settings";
import { streakProtection as streakProtectionPl } from "./locales/pl/streak-protection";

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
    deleteAccount,
    accountSettings,
    streakProtection,
  },
  pl: {
    auth: authPl,
    common: commonPl,
    home: homePl,
    profile: profilePl,
    calendar: calendarPl,
    modal: modalPl,
    designSystem: designSystemPl,
    workout: workoutPl,
    exercisePicker: exercisePickerPl,
    generateWorkout: generateWorkoutPl,
    history: historyPl,
    stats: statsPl,
    workoutPreview: workoutPreviewPl,
    trainingPreferences: trainingPreferencesPl,
    strengthBaselines: strengthBaselinesPl,
    exerciseDetail: exerciseDetailPl,
    exercisePreference: exercisePreferencePl,
    measurements: measurementsPl,
    feedback: feedbackPl,
    subscription: subscriptionPl,
    healthSync: healthSyncPl,
    deleteAccount: deleteAccountPl,
    accountSettings: accountSettingsPl,
    streakProtection: streakProtectionPl,
  },
} as const;

export type AppResources = (typeof resources)["en"];
