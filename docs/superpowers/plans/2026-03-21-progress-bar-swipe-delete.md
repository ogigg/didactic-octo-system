# Progress Bar Polish + Swipe-to-Delete Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the workout screen's progress bar full-bleed with animated width, and replace the set row's `Swipeable` delete with a custom `PanGestureHandler` that supports full-swipe-to-delete with a height-collapse animation.

**Architecture:** Two independent changes in two files. The progress bar is a pure styling + animation change in `workout.tsx`. The swipe-to-delete is a complete component rebuild in `set-row.tsx` — `Swipeable` is removed and replaced with a `PanGestureHandler` that drives three `Animated.Value`s (translateX, rowHeight, rowOpacity). `translateX` uses the native driver; `rowHeight` and `rowOpacity` use the JS driver and are run as a separate parallel group to avoid React Native's mixed-driver restriction.

**Tech Stack:** React Native `Animated` API, `react-native-gesture-handler` (`PanGestureHandler`, `NativeViewGestureHandler`, `State`), `expo-haptics`, `react-i18next`

---

## File Map

| File                                         | Action | What changes                                                                                                                                   |
| -------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/app/workout.tsx`                | Modify | Remove padding from progress bar container; add `Animated.Value` for width; animate on set completion                                          |
| `apps/mobile/components/workout/set-row.tsx` | Modify | Remove `Swipeable`; add `PanGestureHandler` with gesture callbacks, background color interpolation, bin icon, height-collapse delete animation |

---

## Task 1: Animated full-bleed progress bar

**Files:**

- Modify: `apps/mobile/app/workout.tsx`

- [ ] **Step 1: Remove padding from `progressBarContainer` and add `Easing` import**

In `apps/mobile/app/workout.tsx`:

Add `Easing` to the React Native import:

```ts
import {
  Animated,
  Easing,
  Keyboard,
  // ...rest unchanged
} from "react-native";
```

Change `progressBarContainer` in `StyleSheet.create`:

```ts
progressBarContainer: {
  // remove paddingHorizontal and paddingTop
  paddingBottom: Spacing.sm,
},
```

- [ ] **Step 2: Replace static `progressWidth` with an `Animated.Value`**

Remove these lines:

```ts
const progressRatio = totalSets > 0 ? completedSets / totalSets : 0;
const progressWidth =
  `${Math.min(Math.max(progressRatio, 0), 1) * 100}%` as const;
```

Replace with:

```ts
const progressRatio = totalSets > 0 ? completedSets / totalSets : 0;
const animatedProgress = useRef(new Animated.Value(progressRatio)).current;
```

Add a `useEffect` after the `animatedProgress` declaration:

```ts
useEffect(() => {
  Animated.timing(animatedProgress, {
    toValue: progressRatio,
    duration: 300,
    easing: Easing.out(Easing.quad),
    useNativeDriver: false,
  }).start();
}, [completedSets, totalSets]);
```

- [ ] **Step 3: Update the JSX to use `Animated.View` for the fill**

Replace:

```tsx
<View
  style={[
    styles.progressFill,
    { backgroundColor: primary, width: progressWidth },
  ]}
/>
```

With:

```tsx
<Animated.View
  style={[
    styles.progressFill,
    {
      backgroundColor: primary,
      width: animatedProgress.interpolate({
        inputRange: [0, 1],
        outputRange: ["0%", "100%"],
      }),
    },
  ]}
/>
```

- [ ] **Step 4: Verify the app renders without errors**

Run: `npx expo start` in `apps/mobile/` and confirm:

- Progress bar is full width (edge to edge)
- Bar is flush against the top bar's bottom border (no gap)
- Completing a set causes the bar to animate smoothly to the new width

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/workout.tsx
git commit -m "feat: full-bleed animated progress bar on workout screen"
```

---

## Task 2: Replace `Swipeable` with custom `PanGestureHandler` in `set-row.tsx`

**Files:**

- Modify: `apps/mobile/components/workout/set-row.tsx`

### Step 2.1 — Update imports

- [ ] **Step 1: Replace `Swipeable` import with `PanGestureHandler`, `NativeViewGestureHandler`, and `State`**

Remove:

```ts
import { Swipeable } from "react-native-gesture-handler";
```

Add:

```ts
import {
  PanGestureHandler,
  NativeViewGestureHandler,
  State,
} from "react-native-gesture-handler";
```

Add `Easing` to the React Native import (it's already used in the existing animation code — verify it's present, add if missing):

```ts
import {
  Animated,
  Dimensions,
  Easing,
  // ...rest unchanged — remove LayoutAnimation and UIManager if only used for Swipeable
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
```

Remove the `UIManager.setLayoutAnimationEnabledExperimental` block at the top of the file (lines 23–28 in the original) — it was only needed for `LayoutAnimation`.

### Step 2.2 — Add new refs and animated values

- [ ] **Step 2: Add `Dimensions`, new refs, and animated values inside the component**

After the existing `const completeRing = useRef(...)` line, add:

```ts
const screenWidth = Dimensions.get("window").width;
const translateX = useRef(new Animated.Value(0)).current;
const rowHeight = useRef(new Animated.Value(64)).current;
const rowOpacity = useRef(new Animated.Value(1)).current;
const isDeleting = useRef(false);
```

### Step 2.3 — Add unmount cleanup effect

- [ ] **Step 3: Add a `useEffect` cleanup to stop animations on unmount**

Add after the existing hooks:

```ts
useEffect(() => {
  return () => {
    translateX.stopAnimation();
    rowHeight.stopAnimation();
    rowOpacity.stopAnimation();
  };
}, []);
```

### Step 2.4 — Add delete sequence helper

- [ ] **Step 4: Add `triggerDelete` and `springBack` callbacks**

Replace the existing `handleDelete` callback with these two:

```ts
const springBack = useCallback(() => {
  Animated.spring(translateX, {
    toValue: 0,
    tension: 180,
    friction: 14,
    useNativeDriver: true,
  }).start();
}, [translateX]);

const triggerDelete = useCallback(() => {
  if (isDeleting.current) return;
  isDeleting.current = true;

  if (Platform.OS === "ios") {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }

  // translateX on native driver — must run separately from layout props
  Animated.timing(translateX, {
    toValue: -screenWidth,
    duration: 200,
    useNativeDriver: true,
  }).start();

  // rowHeight and rowOpacity on JS driver
  Animated.parallel([
    Animated.timing(rowHeight, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }),
    Animated.timing(rowOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }),
  ]).start(() => onRemove());
}, [translateX, rowHeight, rowOpacity, screenWidth, onRemove]);
```

Remove the now-unused `handleSwipeableOpen` callback and `swipeableRef`.

### Step 2.5 — Add gesture event handlers

- [ ] **Step 5: Add `onGestureEvent` and `onHandlerStateChange` callbacks**

```ts
const onGestureEvent = useCallback(
  (e: { nativeEvent: { translationX: number } }) => {
    if (isDeleting.current) return;
    const clamped = Math.min(
      Math.max(e.nativeEvent.translationX, -screenWidth),
      0
    );
    translateX.setValue(clamped);
  },
  [translateX, screenWidth]
);

const onHandlerStateChange = useCallback(
  (e: { nativeEvent: { state: number; translationX: number } }) => {
    const { state, translationX: tx } = e.nativeEvent;
    if (state === State.END) {
      if (tx <= -80) {
        triggerDelete();
      } else {
        springBack();
      }
    } else if (state === State.CANCELLED || state === State.FAILED) {
      springBack();
    }
  },
  [triggerDelete, springBack]
);
```

### Step 2.6 — Derive interpolated styles

- [ ] **Step 6: Add background color and bin icon scale interpolations**

After the existing `completeRingOpacity` interpolation, add:

```ts
// Resolve errorColor hex to a zero-alpha version for clean interpolation
// errorColor is e.g. "#FF453A" — append "00" for transparent
const errorColorTransparent = errorColor + "00";

const swipeBackgroundColor = translateX.interpolate({
  inputRange: [-120, 0],
  outputRange: [errorColor, errorColorTransparent],
  extrapolate: "clamp",
});

const binIconScale = translateX.interpolate({
  inputRange: [-80, 0],
  outputRange: [1.15, 1.0],
  extrapolate: "clamp",
});
```

### Step 2.7 — Rebuild JSX

- [ ] **Step 7: Replace `Swipeable` wrapper with `PanGestureHandler` and update structure**

Replace the entire `return (...)` block with:

```tsx
return (
  <Animated.View
    style={{ height: rowHeight, opacity: rowOpacity, overflow: "hidden" }}
    onLayout={(e) => {
      if (!isDeleting.current) {
        rowHeight.setValue(e.nativeEvent.layout.height);
      }
    }}
  >
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetX={[-8, 8]}
      failOffsetY={[-12, 12]}
    >
      <Animated.View style={{ transform: [{ translateX }] }}>
        {/* Red delete background */}
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: swipeBackgroundColor },
          ]}
        >
          <NativeViewGestureHandler>
            <Pressable
              onPress={triggerDelete}
              accessibilityRole="button"
              accessibilityLabel={t("exercise.removeSet")}
              style={styles.deletePressable}
            >
              <Animated.View style={{ transform: [{ scale: binIconScale }] }}>
                <IconSymbol name="trash" size={20} color="#FFFFFF" />
              </Animated.View>
            </Pressable>
          </NativeViewGestureHandler>
        </Animated.View>

        {/* Row content */}
        <View style={[styles.row, set.isCompleted && styles.completedRow]}>
          <Text
            style={[
              Typography.caption,
              styles.setCol,
              { color: setLabelColor },
            ]}
          >
            {setLabel}
          </Text>

          <Pressable
            onPress={handleFillFromPrevious}
            style={styles.prevCol}
            accessibilityRole="button"
            accessibilityLabel={
              set.previousDisplay
                ? `Previous: ${set.previousDisplay}. Tap to fill.`
                : "No previous data"
            }
          >
            <Text style={[Typography.caption, { color: textMuted }]}>
              {set.previousDisplay ?? "-"}
            </Text>
          </Pressable>

          <TextInput
            ref={kgRef}
            style={[
              styles.input,
              {
                backgroundColor: kgFocused ? inputFillFocused : inputFill,
                color: textColor,
                borderColor: kgFocused ? primary : "transparent",
              },
            ]}
            value={set.kg}
            onChangeText={handleKgChange}
            onFocus={() => setKgFocused(true)}
            onBlur={() => setKgFocused(false)}
            onSubmitEditing={handleKgSubmit}
            returnKeyType="next"
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={textDisabled}
            accessibilityLabel={`Weight in kg for set ${setLabel}`}
            selectTextOnFocus
          />

          <TextInput
            ref={repsRef}
            style={[
              styles.input,
              {
                backgroundColor: repsFocused ? inputFillFocused : inputFill,
                color: textColor,
                borderColor: repsFocused ? primary : "transparent",
              },
            ]}
            value={set.reps}
            onChangeText={handleRepsChange}
            onFocus={() => setRepsFocused(true)}
            onBlur={() => setRepsFocused(false)}
            returnKeyType="done"
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={textDisabled}
            accessibilityLabel={`Reps for set ${setLabel}`}
            selectTextOnFocus
          />

          <Pressable
            onPress={() => setRpePickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={`RPE for set ${setLabel}: ${set.rpe ?? "not set"}`}
            style={[styles.rpeButton, { backgroundColor: inputFill }]}
          >
            <Text
              style={[
                Typography.caption,
                { color: set.rpe ? textColor : textDisabled },
              ]}
            >
              {set.rpe ?? "--"}
            </Text>
          </Pressable>

          <View style={styles.checkboxWrapper}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.completeRing,
                {
                  borderColor: success,
                  opacity: completeRingOpacity,
                  transform: [{ scale: completeRingScale }],
                },
              ]}
            />
            <Animated.View style={{ transform: [{ scale: completeScale }] }}>
              <Pressable
                onPress={handleToggleComplete}
                onPressIn={handleCompletePressIn}
                onPressOut={handleCompletePressOut}
                accessibilityRole="checkbox"
                accessibilityLabel={`Set ${setLabel}: ${set.isCompleted ? "completed" : "not completed"}`}
                accessibilityState={{ checked: set.isCompleted }}
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: set.isCompleted ? success : "transparent",
                    borderColor: set.isCompleted ? success : textDisabled,
                  },
                ]}
              >
                {set.isCompleted && (
                  <IconSymbol name="checkmark" size={14} color="#FFFFFF" />
                )}
              </Pressable>
            </Animated.View>
          </View>

          <RpePicker
            visible={rpePickerVisible}
            currentValue={set.rpe}
            onSelect={onUpdateRpe}
            onClose={() => setRpePickerVisible(false)}
          />
        </View>
      </Animated.View>
    </PanGestureHandler>
  </Animated.View>
);
```

### Step 2.8 — Update styles

- [ ] **Step 8: Remove `Swipeable`-specific styles, add `deletePressable` update**

Remove these style entries (no longer needed):

- `deleteAction`
- `deleteActionContent`

Update `deletePressable` to position the bin icon at the right edge:

```ts
deletePressable: {
  position: "absolute",
  right: 0,
  top: 0,
  bottom: 0,
  width: 60,
  alignItems: "center",
  justifyContent: "center",
},
```

### Step 2.9 — Verify

- [ ] **Step 9: Run the app and verify the swipe behaviour**

Run: `npx expo start` in `apps/mobile/` and verify:

- Swiping a row left reveals a red background with a bin icon that scales up
- Releasing before `−80px` springs the row back smoothly
- Releasing at/past `−80px` slides the row off left while the row height collapses to 0 with no layout jump
- Tapping the bin icon triggers the same slide + collapse
- Vertical scrolling is not accidentally triggered by left swipes
- Haptic fires on delete (iOS)

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/components/workout/set-row.tsx
git commit -m "feat: swipe-to-delete with height-collapse animation in set row"
```
