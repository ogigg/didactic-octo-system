import { common } from "./locales/en/common";
import { home } from "./locales/en/home";
import { explore } from "./locales/en/explore";
import { modal } from "./locales/en/modal";
import { designSystem } from "./locales/en/design-system";

export const resources = {
  en: {
    common,
    home,
    explore,
    modal,
    designSystem,
  },
} as const;

export type AppResources = (typeof resources)["en"];
