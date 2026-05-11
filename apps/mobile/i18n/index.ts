import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { resources } from "./resources";

export const supportedLanguages = ["en", "pl"] as const;

export type AppLanguage = (typeof supportedLanguages)[number];

export const languageLabels: Record<AppLanguage, string> = {
  en: "English",
  pl: "Polski",
};

const LANGUAGE_STORAGE_KEY = "app-language";

function isAppLanguage(language: string): language is AppLanguage {
  return supportedLanguages.includes(language as AppLanguage);
}

export function normalizeLanguage(language?: string | null): AppLanguage {
  const baseLanguage = language?.toLowerCase().split("-")[0];
  return baseLanguage && isAppLanguage(baseLanguage) ? baseLanguage : "en";
}

export function getCurrentLanguage(): AppLanguage {
  return normalizeLanguage(i18next.resolvedLanguage ?? i18next.language);
}

export async function changeAppLanguage(language: AppLanguage) {
  await i18next.changeLanguage(language);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

const deviceLanguage = normalizeLanguage(getLocales()[0]?.languageCode);

i18next.use(initReactI18next).init({
  resources,
  lng: deviceLanguage,
  fallbackLng: "en",
  supportedLngs: supportedLanguages,
  defaultNS: "common",
  interpolation: {
    escapeValue: false,
  },
});

void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
  .then((storedLanguage) => {
    if (!storedLanguage) {
      return;
    }

    const language = normalizeLanguage(storedLanguage);

    if (language !== getCurrentLanguage()) {
      void i18next.changeLanguage(language);
    }
  })
  .catch(() => {
    // Keep the device language if persisted preferences cannot be read.
  });

export default i18next;
