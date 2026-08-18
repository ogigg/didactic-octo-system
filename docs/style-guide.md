# UI Style Guide

> **Document status:** Current index
> **Purpose:** Route contributors to canonical visual and interaction standards.
> **Last reviewed:** 2026-08-18

## Table Of Contents

- [Foundations](#foundations)
- [Component Standards](#component-standards)
- [Bottom Sheets](#bottom-sheets)
- [Adding Or Changing A Standard](#adding-or-changing-a-standard)

## Foundations

Use [`.ai/ui-guidelines.md`](../.ai/ui-guidelines.md) for the design philosophy,
theme tokens, typography, spacing, radii, accessibility baseline, and existing
component patterns. The coded values in
[`apps/mobile/constants/theme.ts`](../apps/mobile/constants/theme.ts) take
precedence if a documented token value becomes stale.

## Component Standards

Prefer shared components and existing patterns before introducing a feature-local
implementation. Current detailed standards include:

- buttons, inputs, lists, navigation, and workout UI in
  [`.ai/ui-guidelines.md`](../.ai/ui-guidelines.md#component-patterns)
- [bottom sheets and modal selection](styles/bottom-sheets.md)
- localization and user-facing copy in [`.ai/i18n.md`](../.ai/i18n.md)

## Bottom Sheets

Use the [Bottom Sheets And Modals Standard](styles/bottom-sheets.md) when adding
or changing any sheet, modal form, action menu, or keyboard-enabled overlay. It
defines when to use a sheet, the required `AppBottomSheet` API, keyboard and
dismissal behavior, styling, accessibility, and tests.

## Adding Or Changing A Standard

1. Check the shared component and existing standard before adding a pattern.
2. Update implementation and documentation together when behavior changes.
3. Put detailed component guidance in `docs/styles/<component>.md` and link it
   from this index.
4. Update `.ai/ui-guidelines.md` when the change affects global visual tokens or
   design philosophy.
5. Verify light and dark themes, iOS and Android behavior, accessibility, and
   localization as applicable.
