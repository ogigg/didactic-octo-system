# Bottom Sheets And Modals Standard

> **Document status:** Current standard
> **Purpose:** Define how modal presentations and bottom sheets are selected, implemented, styled, and tested.
> **Last reviewed:** 2026-08-24

This is an arc42 section 8 cross-cutting concept. It applies to every mobile
feature that presents content above the current screen.

## Table Of Contents

- [Choose The Presentation](#choose-the-presentation)
- [Canonical Component](#canonical-component)
- [Implementation Pattern](#implementation-pattern)
- [Interaction Standards](#interaction-standards)
- [Keyboard And Form Standards](#keyboard-and-form-standards)
- [Visual Standards](#visual-standards)
- [Accessibility And Localization](#accessibility-and-localization)
- [Testing](#testing)
- [Review Checklist](#review-checklist)

## Choose The Presentation

| Presentation     | Use when                                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AppBottomSheet` | The task is contextual, short, and should return the user to the current screen: action menus, pickers, compact forms, or confirmations with supporting detail. |
| Navigation route | The content is multi-step, dense, independently navigable, deep-linkable, or needs most of the screen. A route may use a full-screen modal presentation.        |
| Native alert     | The message is brief and needs only a simple acknowledgement or two-choice confirmation.                                                                        |

Do not build a bottom sheet directly with React Native `Modal`. `Modal` is the
low-level primitive owned by the shared component. Do not copy
`RestTimerSheet`; it is a specialized live-timer presentation whose interaction
model informed the shared component.

## Canonical Component

New sheets must use
[`AppBottomSheet`](../../apps/mobile/components/ui/app-bottom-sheet.tsx).
It owns the behavior that should remain consistent across features:

- backdrop and slide animations, including reduced-motion handling
- safe-area padding and elevated surface styling
- drag-handle dismissal
- Android back-button and accessibility-escape dismissal
- keyboard avoidance on iOS and Android
- backdrop taps that dismiss a visible keyboard before closing the sheet
- an imperative `dismiss(afterClose)` API for sequencing actions after the
  closing animation
- an optional `height` override for compact content that should preserve
  more tappable backdrop than the default sheet maximum

Feature sheets own only their content, feature state, and callbacks.

## Implementation Pattern

```tsx
import {
  AppBottomSheet,
  type AppBottomSheetHandle,
} from "@/components/ui/app-bottom-sheet";
import { Button } from "@/components/ui/button";
import { Spacing } from "@/constants/theme";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Platform, ScrollView, StyleSheet } from "react-native";

interface ExampleSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function ExampleSheet({ visible, onClose, onConfirm }: ExampleSheetProps) {
  const { t } = useTranslation("example");
  const sheetRef = useRef<AppBottomSheetHandle>(null);

  return (
    <AppBottomSheet
      ref={sheetRef}
      visible={visible}
      onClose={onClose}
      closeAccessibilityLabel={t("sheet.close")}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
      >
        {/* Localized feature content */}
        <Button
          label={t("sheet.confirm")}
          onPress={() => sheetRef.current?.dismiss(onConfirm)}
        />
      </ScrollView>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
});
```

Use a plain `View` instead of `ScrollView` only when the content is guaranteed
to fit on supported screen sizes and does not contain text input.

## Interaction Standards

- The backdrop closes a sheet when the keyboard is not visible.
- A backdrop tap dismisses the keyboard first when an input is active. It must
  not discard entered text.
- Users can drag the handle down or use the platform back/escape gesture.
- Primary and destructive actions call `dismiss(callback)` so the sheet closes
  before navigation, mutation, or another overlay begins.
- Keep feature draft state outside the sheet when accidental data loss would be
  costly. Clear it only when the product flow intentionally starts a new draft
  or completes/cancels the action.
- Do not nest another modal or sheet inside an open sheet. Close the current
  sheet before presenting the next surface.

## Keyboard And Form Standards

- Rely on `AppBottomSheet` for platform keyboard avoidance; do not add a second
  `KeyboardAvoidingView` inside a feature sheet.
- Wrap form content in a scroll view with platform-appropriate
  `keyboardDismissMode` and `keyboardShouldPersistTaps="handled"`.
- Keep the focused input and all required actions reachable on the smallest
  supported screen.
- Multiline inputs use `textAlignVertical="top"` and an explicit maximum length
  where the backend or AI prompt has a practical limit.
- Tapping an action while the keyboard is open must activate the action, not
  merely consume the tap.

## Visual Standards

- Use theme tokens from `constants/theme.ts`; do not hardcode sheet surfaces,
  borders, spacing, radii, or text colors.
- Use the shared handle, backdrop, top-corner radius, elevation, maximum height,
  and safe-area behavior from `AppBottomSheet`.
- Use a smaller `height` for compact selection sheets when the default would
  leave too little tappable backdrop. Keep long content scrollable inside it.
- Feature content uses `Spacing.xl` horizontal padding unless an established
  component pattern requires otherwise.
- Use the typography hierarchy from `.ai/ui-guidelines.md`. A typical sheet has
  one title, optional supporting copy, content, and a compact action group.
- Do not add a second handle, custom backdrop, or feature-specific entrance and
  exit animation.

## Accessibility And Localization

- Provide a localized `closeAccessibilityLabel`.
- Give actions an accessibility role and localized label.
- Set all user-facing strings in `i18n/locales/en/` and every supported locale;
  do not hardcode copy in JSX.
- Keep touch targets at least 44 by 44 points.
- Ensure the sheet content is exposed as a modal accessibility view; the shared
  component owns `accessibilityViewIsModal` and accessibility escape.
- Test layouts with larger text where content or actions may wrap.

## Testing

Shared behavior belongs in
[`app-bottom-sheet.test.tsx`](../../apps/mobile/components/ui/__tests__/app-bottom-sheet.test.tsx).
Feature tests should cover user-visible behavior rather than animation internals:

- the sheet opens from the intended action
- input text remains after dismissing the keyboard
- primary, secondary, and destructive actions call the correct callback
- closing does not trigger a feature action
- accessibility labels can locate the sheet and its controls

Prefer accessibility queries. Use `testID` only when a semantic query cannot
identify the presentation boundary.

## Review Checklist

- [ ] The presentation choice matches the decision table.
- [ ] The feature uses `AppBottomSheet` rather than a raw `Modal`.
- [ ] Keyboard, backdrop, drag, back, and accessibility escape behavior work.
- [ ] Inputs and actions remain reachable on iOS, Android, and small screens.
- [ ] Actions are sequenced through `dismiss(callback)`.
- [ ] Styles use theme tokens and copy is localized.
- [ ] Relevant behavior tests pass.
- [ ] This standard is updated if shared behavior changed.
