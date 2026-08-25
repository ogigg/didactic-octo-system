# UI Guidelines Design Spec

> **Document status:** Reference document
> **Purpose:** Capture design tokens, UI patterns, and visual consistency guidance for the mobile app.
> **Last reviewed:** 2026-04-18

## Overview

Design system and UI guidelines for the AI-powered workout generation mobile app. Defines design tokens (colors, typography, spacing, radii) and component patterns (buttons, inputs, set table, rest timer, navigation, bottom sheets, difficulty feedback) to ensure visual consistency across all screens.

**Design philosophy — "Quiet Intensity":** Content-first, minimal chrome, dark-default. Gradients are atmospheric, not decorative — they replace flat fills to give depth without drawing a hard box. Prefer typographic rhythm and hairline separators over stacked cards. Every screen should feel unified: same rhythm, same surface treatment, same button language.

**Anti-patterns to avoid:**

- **Card stacking.** Do not wrap every piece of content in its own elevated container. If three consecutive sections are all "a card with a title", collapse them into a single grouped list or drop the card chrome entirely.
- **Dashed bordered placeholders.** The "Create Workout" dashed card is banned. Use an inline `SectionHeader` action (`+ New`) instead.
- **Redundant full-width footer buttons.** "See History" style links do not get their own full-width button; use a `SectionHeader` with a chevron action.
- **2×2 icon grids of navigation.** Use `ListGroup` + `ListRow` for settings-style menus.
- **Sharp primary-color fills on large surfaces.** Use the `hero` gradient (sky → violet) for primary CTAs; use the `accent` or `surface` gradient for anything larger than a button.

**Delivery:** Coded design tokens in `constants/theme.ts` + companion pattern doc in `.ai/ui-guidelines.md` + Storybook-style reference screen in the app.

---

## Design Tokens

### Color System

> **Note:** In light mode, `backgroundElevated` and `background` share the same value; the visual distinction comes from the 1px `border` outline on elevated containers (e.g., set table).

#### Light Mode

| Token                  | Value                   | Usage                                               |
| ---------------------- | ----------------------- | --------------------------------------------------- |
| `background`           | `#FFFFFF`               | Main app background                                 |
| `backgroundSubtle`     | `#F9F9F8`               | Section backgrounds, non-table containers           |
| `backgroundElevated`   | `#FFFFFF`               | Table container background (white, with border)     |
| `text`                 | `#1A1A1A`               | Primary text, headings                              |
| `textSecondary`        | `#777777`               | Labels, secondary info                              |
| `textMuted`            | `#AAAAAA`               | Placeholders, column headers                        |
| `textDisabled`         | `#DDDDDD`               | Empty states, unfilled fields                       |
| `primary`              | `#3898D8`               | Accent, CTAs, active states                         |
| `primarySurface`       | `#E8F2FA`               | Chips, light accent backgrounds                     |
| `primaryContainer`     | `#F5F9FC`               | Secondary buttons, subtle highlights                |
| `border`               | `#F0EEEB`               | Row separators, table container border              |
| `borderSubtle`         | `#F5F5F4`               | Non-table input backgrounds                         |
| `inputFill`            | `#F0F0EE`               | Set table input backgrounds (darker than container) |
| `inputFillFocused`     | `#EAF3FB`               | Focused input background (blue tint)                |
| `success`              | `#34C759`               | Completed sets, PRs                                 |
| `warning`              | `#FFAC30`               | "Too Hard" feedback                                 |
| `error`                | `#FF3B30`               | Destructive actions, validation                     |
| `destructiveSurface`   | `#FFF0F0`               | Destructive button background                       |
| `glow`                 | `rgba(56,152,216,0.07)` | Ambient radial background flare                     |
| `surfaceGradientStart` | `#FBFBFA`               | Neutral surface wash — top-left stop                |
| `surfaceGradientEnd`   | `#F4F2EF`               | Neutral surface wash — bottom-right stop            |
| `heroGradientStart`    | `#3898D8`               | Hero CTA gradient — sky (top-left)                  |
| `heroGradientEnd`      | `#5E6EE0`               | Hero CTA gradient — violet (bottom-right)           |
| `accentGradientStart`  | `rgba(56,152,216,0.08)` | Translucent accent wash — start                     |
| `accentGradientEnd`    | `rgba(94,110,224,0.05)` | Translucent accent wash — end                       |

#### Dark Mode

| Token                  | Value                   | Usage                                                |
| ---------------------- | ----------------------- | ---------------------------------------------------- |
| `background`           | `#121416`               | Main app background                                  |
| `backgroundSubtle`     | `#1A1D20`               | Section backgrounds, non-table containers            |
| `backgroundElevated`   | `#161819`               | Table container background (with border)             |
| `text`                 | `#E8E8E8`               | Primary text                                         |
| `textSecondary`        | `#888888`               | Labels                                               |
| `textMuted`            | `#555555`               | Placeholders, headers                                |
| `textDisabled`         | `#444444`               | Empty states                                         |
| `primary`              | `#5AAEE0`               | Accent (slightly lighter for dark bg)                |
| `primarySurface`       | `#1A2028`               | Chip backgrounds                                     |
| `primaryContainer`     | `#1E2530`               | Secondary buttons                                    |
| `border`               | `#2A2D30`               | Row separators, table container border               |
| `borderSubtle`         | `#1E2022`               | Non-table input backgrounds                          |
| `inputFill`            | `#232629`               | Set table input backgrounds (lighter than container) |
| `inputFillFocused`     | `#1A2028`               | Focused input background (blue tint)                 |
| `success`              | `#30D158`               | Completed sets                                       |
| `warning`              | `#FFD60A`               | Feedback                                             |
| `error`                | `#FF453A`               | Destructive                                          |
| `destructiveSurface`   | `#2A1215`               | Destructive button background                        |
| `glow`                 | `rgba(56,152,216,0.05)` | Ambient flare                                        |
| `surfaceGradientStart` | `#1C1F22`               | Neutral surface wash — top-left stop                 |
| `surfaceGradientEnd`   | `#141618`               | Neutral surface wash — bottom-right stop             |
| `heroGradientStart`    | `#3898D8`               | Hero CTA gradient — sky (top-left)                   |
| `heroGradientEnd`      | `#5E5BD4`               | Hero CTA gradient — violet (bottom-right)            |
| `accentGradientStart`  | `rgba(90,174,224,0.10)` | Translucent accent wash — start                      |
| `accentGradientEnd`    | `rgba(110,91,212,0.04)` | Translucent accent wash — end                        |

### Opacity

| Token      | Value  | Usage                          |
| ---------- | ------ | ------------------------------ |
| `pressed`  | `0.95` | Button/touchable pressed state |
| `disabled` | `0.5`  | Disabled interactive elements  |

### Shadow / Elevation

React Native shadows differ by platform. Use these presets:

| Token         | iOS                                                                                            | Android        | Usage                        |
| ------------- | ---------------------------------------------------------------------------------------------- | -------------- | ---------------------------- |
| `elevationSm` | `shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.08, shadowRadius: 4` | `elevation: 2` | Rest timer bar, subtle lifts |
| `elevationMd` | `shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.12, shadowRadius: 8` | `elevation: 4` | Bottom sheets, modals        |

### Spacing Scale (4px base)

| Token | Value  | Usage                              |
| ----- | ------ | ---------------------------------- |
| `xs`  | `4px`  | Tight gaps (icon to text)          |
| `sm`  | `8px`  | Inline spacing, small gaps         |
| `md`  | `12px` | Between set rows, compact sections |
| `lg`  | `16px` | Container padding, section gaps    |
| `xl`  | `20px` | Screen horizontal padding          |
| `2xl` | `24px` | Between exercise groups            |
| `3xl` | `32px` | Major section breaks               |
| `4xl` | `40px` | Screen top/bottom safe padding     |
| `5xl` | `48px` | Large vertical breathing room      |

### Corner Radius (Mixed Hierarchy)

| Token        | Value    | Usage                                     |
| ------------ | -------- | ----------------------------------------- |
| `radiusSm`   | `8px`    | Data containers, inputs, set table inputs |
| `radiusMd`   | `10px`   | Exercise group containers                 |
| `radiusLg`   | `14px`   | Buttons, bottom sheets, modals            |
| `radiusFull` | `9999px` | Tags, chips, checkmarks, circular buttons |

**Principle:** Tight radius = data/informational. Round radius = interactive/tappable. Shape communicates function.

### Typography Scale (System Fonts)

System default font — no explicit `fontFamily` required in React Native. For tabular number display, use `fontVariant: ['tabular-nums']`. The existing `Fonts` constant in `constants/` handles platform-specific font family selection.

| Token        | Size   | Weight | Letter Spacing | Usage                                        |
| ------------ | ------ | ------ | -------------- | -------------------------------------------- |
| `displayLg`  | `28px` | 700    | `-0.5px`       | Hero numbers (expanded timer, total tonnage) |
| `displaySm`  | `20px` | 700    | `-0.3px`       | Collapsed timer countdown                    |
| `titleLg`    | `22px` | 700    | `-0.3px`       | Screen titles                                |
| `titleMd`    | `17px` | 600    | `0`            | Section headings                             |
| `titleSm`    | `15px` | 600    | `-0.2px`       | Exercise names                               |
| `body`       | `14px` | 400    | `0`            | General content                              |
| `bodyMedium` | `14px` | 500    | `0`            | Set data (kg, reps)                          |
| `caption`    | `12px` | 400    | `0`            | Previous data, secondary info                |
| `label`      | `11px` | 500    | `0.3px`        | Column headers (uppercase)                   |
| `micro`      | `10px` | 500    | `0`            | Units (kg, reps), metadata                   |

All numeric displays use `fontVariant: ['tabular-nums']` for column alignment.

---

## Component Patterns

### Gradient Surfaces

All elevated containers larger than a button should use `<GradientSurface>` from `components/ui/gradient-surface.tsx` instead of a flat `backgroundColor`. The gradient direction is always top-left → bottom-right (`{x:0,y:0}` → `{x:1,y:1}`) — consistent direction is what makes the system feel unified rather than decorative.

**Variants:**

- **`surface`** — Neutral wash, ~5% luminosity shift. Default for progress strips, chart cards, non-hero containers. Replaces `backgroundColor: backgroundSubtle`.
- **`hero`** — Sky-blue → violet gradient. Reserved for primary CTAs the user should act on (the floating "Start Workout" primary button, active workout hero cards). Use sparingly — one hero per screen.
- **`accent`** — Translucent primary tint over whatever is behind. For "NEXT UP" cards, notification surfaces, informational callouts. Works well over `AmbientGlow`.

**Props:** `variant`, `radius` (keyof Radii or number), `bordered` (adds a hairline `border`-color outline).

### Section Header

Use `<SectionHeader>` from `components/ui/section-header.tsx` for every section title. It supports an inline `action` with `plus` or `chevron.right` icons, which replaces patterns like:

- Dashed "+ Create" cards at the end of horizontal lists → `action={{ label: "Create Workout", icon: "plus", onPress }}`.
- Full-width "See history" footer buttons → `action={{ label: "View", icon: "chevron.right", onPress }}`.

The inline action renders as `primary`-colored text, not a button background. This is the primary way to expose secondary actions in the app — do not invent new link styles.

### List Row + List Group

Use `<ListGroup>` wrapping `<ListRow>` items from `components/ui/list-row.tsx` for:

- Settings menus (Profile screen — tracking, settings, account groupings)
- Any "list of navigable items with icon + label + chevron" pattern

Rules:

- Group related items (4–5 per group max). Separate unrelated groups with a `SectionHeader`.
- Pass `position="first" | "middle" | "last" | "only"` — the row auto-hides its bottom separator on the last item.
- The group gets a single hairline outline (`border`, `Radii.lg`); rows inside get hairline separators between them. No per-row elevation or background.
- Never give each row its own card or `Elevation`.

### Buttons

**Variants:**

- **Primary:** `primary` bg, white text (light) / dark text (dark). `radiusLg` (14px). 13px padding vertical.
- **Primary (pressed):** Slightly darker primary, `opacity.pressed` (0.95).
- **Secondary:** `primaryContainer` bg, `primary` text. `radiusLg`.
- **Ghost/Text:** No background, `primary` text. For cancel/dismiss actions.
- **Destructive:** `destructiveSurface` bg, `error` text. `radiusLg`.
- **Disabled:** `borderSubtle` bg, `textDisabled` text, `opacity.disabled`. `radiusLg`.
- **Small/Inline (Pills):** `primarySurface` bg, `primary` text. `radiusFull`. 7px vertical, 14px horizontal padding. `caption` size. Used for "History", "Replace", overflow actions on exercise headers.

### Inputs

**Number Input (Set Table):**

- Background: `inputFill` (`#F0F0EE` light / `#232629` dark) — darker than the white table container to create contrast.
- Focused: `inputFillFocused` bg with 1.5px `primary` border.
- Empty: `textDisabled` dash placeholder.
- Text: `bodyMedium` (14px/500), `fontVariant: ['tabular-nums']`, centered.
- Radius: `radiusSm` (8px).

**Text Input:**

- Background: `borderSubtle`.
- Placeholder: `textMuted`.
- Radius: `radiusSm`.

**Checkboxes (Set Completion):**

- Empty: 22px circle, 1.5px `textDisabled` border.
- Complete: 22px circle, `primary` fill, white checkmark.
- PR: 22px circle, `success` fill, white star.

### Set Table

**Structure:** Exercise header → grouped container → column headers → set rows → add set action.

**Container:** `backgroundElevated` (#FFFFFF light / #161819 dark) with 1px `border` outline. `radiusMd` (10px).

**Rows:** Uniform background (no alternating colors). All rows sit on the container background.

- **PR row:** Subtle horizontal gradient tint using `expo-linear-gradient` with `[success@4% opacity, transparent]`.

**Columns:** SET (26px fixed) | PREV (flex) | KG (flex, input) | REPS (flex, input) | CHECK (32px fixed).

**Column Headers:** `label` style (11px/500, uppercase, `textMuted`).

**Set Numbers:** `caption` size, `textSecondary` (completed) / `textDisabled` (empty).

**Previous Data:** `caption` size, `textSecondary`. Format: `80×8`.

**Add Set:** `primary` text, `body` weight 500, centered below table.

**Interactions:** Swipe-to-delete on individual rows. Long-press to reorder sets.

### Rest Timer

**Collapsed (floating bar):**

- Appears at bottom of screen after completing a set.
- `backgroundElevated` bg, `radiusLg`, `elevationSm` shadow.
- Contains: countdown (`displaySm` — 20px/700), progress bar (4px, `primary` fill), "Skip" text button.

**Expanded (full overlay):**

- Tap collapsed bar to expand.
- Centered layout with ambient `glow` behind timer (use blurred `View` or `expo-linear-gradient` for radial effect).
- Large countdown (56px/700, `fontVariant: ['tabular-nums']`).
- Progress bar (6px).
- +/- time adjustment: circular `borderSubtle` buttons (36px, `radiusFull`).
- Actions: "Skip" secondary button, "+30s" primary button.
- Auto-dismiss when timer reaches 0.

### Navigation

**Top Bar (Workout Active):**

- Minimal: workout name (left, `titleSm`), timer (center, `titleSm`/`fontVariant: ['tabular-nums']`), Finish button (right, primary small).
- Single bottom border (`border` color).

**Tab Bar (3 tabs for MVP):**

- Home (workout list / next workout preview), Start/Active Workout, Profile/Settings.
- Icons: 22px stroke, `textMuted` inactive, `primary` active.
- Labels: `micro` size (10px/500).
- **Center tab transforms when workout is active:**
  - Inactive: 44px circle with `primaryContainer` bg, + icon.
  - Active: 44px circle with `primary` fill, lightning icon, green dot indicator, timer replaces label.
- Border top: `border` color.

### Back Button

All screens using a custom header (i.e. `headerShown: false`) must use the `BackButton` component from `components/ui/back-button.tsx` instead of the native Expo Router header or ad-hoc back text links.

**Component:** `BackButton`

```typescript
interface BackButtonProps {
  onPress?: () => void; // Default: router.back()
  label?: string; // Optional text next to chevron
  accessibilityLabel?: string;
}
```

**Visual spec:**

- `chevron.left` icon, 20px, `primary` color
- Optional label: `Typography.body`, `primary` color, `Spacing.xs` (4px) gap
- No background (ghost style)
- 44×44pt minimum touch target (via `hitSlop`)
- Pressed state: `Opacity.pressed` (0.95)

**Standard header layout pattern:**

```
[BackButton (44px)] — [Title centered] — [Spacer (44px) or Action]
```

The left `BackButton` and right spacer share the same width so the title is optically centered.

**Convention:** Never use the native Expo Router stack header for non-tab screens. All pushed/modal screens define `headerShown: false` in `_layout.tsx` and render their own header row.

---

### Bottom Sheet (Exercise Options)

The canonical implementation and interaction standard is
[`docs/styles/bottom-sheets.md`](../docs/styles/bottom-sheets.md). Use
`AppBottomSheet` for new bottom sheets rather than copying an existing feature
sheet or building directly on React Native `Modal`.

- Slides up from bottom with backdrop overlay.
- Background: `backgroundElevated` (light) / `backgroundSubtle` (dark). `elevationMd` shadow.
- Top handle: 36px × 4px, `textDisabled` / `#444`, `radiusFull`.
- Corner radius: `radiusLg` (14px) top corners only.
- Title: exercise name, `titleSm`.
- Options: 14px vertical padding, 18px horizontal, icon (20px, `textSecondary`) + label (`titleSm` size at 15px).
- Destructive action (Delete) separated by border, uses `error` color for both icon and text.

### Difficulty Feedback

- Appears inline after completing all sets for an exercise.
- 3 options in a row: Too Easy, OK, Too Hard. (Display labels map to DB enum: `too_easy`, `ok`, `too_hard`.)
- Each option: `radiusLg`, emoji + label.
- Selected: `primaryContainer` bg with `primary` border (1.5px) and `primary` text.
- Unselected: `borderSubtle` bg (light) / `borderSubtle` bg (dark), `textSecondary` text.
- Auto-advances after brief delay on selection.

### Ambient Glow Effect

Soft radial gradients placed behind key content areas (timer overlay, hero sections). Uses `glow` token. Implement via `expo-linear-gradient` (RadialGradient) or a blurred `View` with the glow color. Positioned absolutely, offset from center for organic feel.

**Implementation:** Use the `<AmbientGlow />` component from `@/components/ambient-glow`.

**Variants:**

- **`hero`**: Large blobs (280px, 200px, 160px) — for hero/content-heavy screens like Home
- **`subtle`**: Smaller blobs (200px, 160px) — for list-based screens like History, Settings
- **`timer`**: Medium blobs — for rest timer overlay

**Usage:** Add `<AmbientGlow variant="..." />` as the first child of the root `View` in every screen. Always include it — the root layout already has one, but screen-level variants can add depth on top.

## Accessibility

- **Contrast ratios:** Minimum 4.5:1 for body text, 3:1 for large text (18px+ or 14px+ bold). All token pairings meet WCAG AA.
- **Touch targets:** Minimum 44×44pt for all interactive elements (buttons, checkboxes, inputs, tab icons).
- **Focus indicators:** Focused inputs show 1.5px `primary` border. All interactive elements must support keyboard/switch focus.
- **Screen readers:** All interactive elements must have `accessibilityLabel`. Set completion checkboxes announce state ("Set 1: completed" / "Set 1: not completed"). Timer announces remaining time.
- **Motion:** Respect `AccessibilityInfo.isReduceMotionEnabled()`. Disable ambient glow animations and auto-advance delays when enabled.

---

## Screen Composition Rules

Every screen must follow this rhythm to stay unified:

1. **Root layer:** `View` → `AmbientGlow` (variant `hero` for home/primary, `subtle` for list/settings) → `SafeAreaView` → `ScrollView`.
2. **Header block:** `displayLg` title + `body` subtitle. No card.
3. **Hero moment (optional):** one `GradientSurface` with `variant="hero"` or `variant="accent"`. At most one per screen.
4. **Content groups:** each group is `SectionHeader` (with optional inline action) followed by its content. Content is either a `GradientSurface variant="surface"`, a `ListGroup`, or a horizontal scroll of `GradientSurface`-wrapped items.
5. **Destructive / footer actions:** `Button variant="destructive"` or a ghost link — never another card.

**Consistent spacing:** outer `ScrollView` uses `paddingHorizontal: Spacing.xl`, `paddingTop: Spacing["2xl"]`, `gap: Spacing.xl`. Never override.

**Don't mix card styles.** If a screen has a `GradientSurface variant="accent"` hero, all other containers on that screen should be `surface` or transparent — not flat `backgroundSubtle` fills.

## Migration Notes

The existing `constants/theme.ts` has a `Colors` object with 6 legacy tokens (`text`, `background`, `tint`, `icon`, `tabIconDefault`, `tabIconSelected`). Implementation should:

1. Replace the `Colors` export entirely with the new token set (light/dark pairs).
2. Update `useThemeColor` hook's TypeScript type to reflect the new token keys.
3. Remove legacy `tint`/`icon`/`tabIconDefault`/`tabIconSelected` tokens.
4. Update all existing components that reference the old tokens.
5. Replace flat `backgroundColor: backgroundSubtle` card patterns with `<GradientSurface variant="surface">`. Legacy screens should be migrated opportunistically when touched.

---

## Deliverables

1. **`constants/theme.ts`** — All design tokens as TypeScript constants, structured in light/dark pairs. Consumed via `useThemeColor` hook.
2. **`.ai/ui-guidelines.md`** — This spec, living alongside other planning docs.
3. **Storybook reference screen** — Dev-only screen in the app that renders all component variants (buttons, inputs, set table states, timer states, navigation, sheets, feedback). Accessible via a hidden dev menu or Expo Router route.

---

## Out of Scope (for MVP)

- Custom fonts (using system fonts)
- Animation specs (will use Reanimated, details TBD per component)
- Iconography system (using Expo Vector Icons / SF Symbols)
- Onboarding screen designs (separate spec — see `.ai/prd.md` US-010 through US-015)
- Post-workout summary screen design (separate spec — see `.ai/prd.md` US-040)
- Loading/skeleton states, error banners, empty states (will be defined per-screen during implementation)
