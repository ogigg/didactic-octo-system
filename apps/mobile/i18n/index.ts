import { getLocales } from "expo-localization";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { resources } from "./resources";

const deviceLanguage = getLocales()[0]?.languageCode ?? "en";

i18next.use(initReactI18next).init({
  resources,
  lng: deviceLanguage,
  fallbackLng: "en",
  defaultNS: "common",
  interpolation: {
    escapeValue: false,
  },
});

export default i18next;
