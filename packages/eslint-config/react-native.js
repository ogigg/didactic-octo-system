import js from "@eslint/js";
import expoConfig from "eslint-config-expo/flat.js";
import eslintConfigPrettier from "eslint-config-prettier";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";
import { config as baseConfig } from "./base.js";

/**
 * A custom ESLint configuration for Expo React Native applications.
 * Extends Expo's recommended config with additional React Native best practices.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const reactNativeConfig = [
  ...baseConfig,
  ...expoConfig,
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      ...pluginReact.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.node,
        ...globals.es2021,
        __dirname: "readonly",
        __filename: "readonly",
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    plugins: {
      "react-hooks": pluginReactHooks,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      // React scope no longer necessary with new JSX transform.
      "react/react-in-jsx-scope": "off",
      // Allow JSX in .tsx files
      "react/jsx-filename-extension": [
        "error",
        { extensions: [".tsx", ".jsx"] },
      ],
      // TypeScript best practices
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Accessibility - React Native components don't use HTML attributes
      "react/jsx-props-no-spreading": "off",
      // Performance optimizations
      "react-hooks/exhaustive-deps": "warn",
      // React Native best practices
      "react/no-array-index-key": "warn",
      "react/self-closing-comp": "warn",
      // Allow console in React Native (common for debugging)
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      ".expo/**",
      ".expo-shared/**",
      "**/*.config.js",
      "**/*.config.ts",
      "**/__tests__/**",
      "**/*.test.{js,jsx,ts,tsx}",
    ],
  },
];

