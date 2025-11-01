// https://docs.expo.dev/guides/using-eslint/
import { reactNativeConfig } from "@repo/eslint-config/react-native";
import { defineConfig } from "eslint/config";

export default defineConfig([
  ...reactNativeConfig,
  {
    ignores: [
      "dist/**",
      "build/**",
      ".expo/**",
      ".expo-shared/**",
      "node_modules/**",
      "**/__tests__/**",
      "**/*.test.{js,jsx,ts,tsx}",
    ],
  },
]);
