# `@repo/eslint-config`

Collection of shared ESLint configurations for the monorepo.

## Available Configs

### `base`
Base configuration with TypeScript, Prettier integration, and Turbo plugin rules.

```js
import { config } from "@repo/eslint-config/base";
```

### `next-js`
Configuration for Next.js applications. Extends `base` and adds Next.js specific rules.

```js
import { nextJsConfig } from "@repo/eslint-config/next-js";
```

### `react-internal`
Configuration for React libraries. Extends `base` and adds React and React Hooks rules.

```js
import { config } from "@repo/eslint-config/react-internal";
```

### `react-native`
Configuration for Expo React Native applications. Extends `base` and adds React Native specific rules and best practices.

```js
import { reactNativeConfig } from "@repo/eslint-config/react-native";
```

Includes:
- React and React Hooks rules
- React Native specific linting rules
- TypeScript support
- Prettier integration
- Modern ES2021+ features
