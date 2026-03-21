import { auth } from "./locales/en/auth";
import { common } from "./locales/en/common";
import { home } from "./locales/en/home";
import { profile } from "./locales/en/profile";
import { modal } from "./locales/en/modal";
import { designSystem } from "./locales/en/design-system";
import { workout } from "./locales/en/workout";

export const resources = {
  en: {
    auth,
    common,
    home,
    profile,
    modal,
    designSystem,
    workout,
  },
} as const;

export type AppResources = (typeof resources)["en"];
