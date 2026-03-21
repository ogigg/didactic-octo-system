# Design: Progress Bar Polish + Swipe-to-Delete Rebuild

**Date:** 2026-03-21
**Scope:** `apps/mobile/app/workout.tsx`, `apps/mobile/components/workout/set-row.tsx`

---

## 1. Progress Bar

### Problem

The current progress bar has `paddingHorizontal: Spacing.lg` and `paddingTop: Spacing.xs`, making it narrower than the screen and visually disconnected from the top bar's bottom border. Width changes are instant with no animation.

### Solution

**In `workout.tsx`:**

- Remove `paddingHorizontal` and `paddingTop` from `progressBarContainer` so the bar spans full width and sits flush against the top bar divider.
- Create `animatedProgress` as `useRef(new Animated.Value(progressRatio)).current`. The workout store persists to AsyncStorage synchronously via Zustand, so `progressRatio` is the real value at mount — no async loading snap.
- In a `useEffect` watching `completedSets` / `totalSets`, call `Animated.timing(animatedProgress, { toValue: progressRatio, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: false }).start()`.
- The `progressFill` becomes an `Animated.View` whose width is derived from `animatedProgress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })`.
- `useNativeDriver: false` is required because `width` is a layout property not supported by the native driver.

**No changes to color, height, or the "X/Y sets" text.**

---

## 2. Swipe-to-Delete Rebuild

### Problem

The existing `Swipeable` component from RNGH does not support full-swipe auto-delete with a clean height-collapse animation. The snap animation from `Swipeable` fights a post-hoc height collapse and causes a visible layout jump.

### Solution

Replace `Swipeable` entirely with a custom `PanGestureHandler`. `onRemove` is already a prop on `SetRowProps`; no interface change is needed.

### Refs and Animated Values

| Name         | Type              | Initial         | Purpose                                           |
| ------------ | ----------------- | --------------- | ------------------------------------------------- |
| `translateX` | `Animated.Value`  | `0`             | Row horizontal position during drag               |
| `rowHeight`  | `Animated.Value`  | `64` (fallback) | Collapses to 0 on delete; updated on first layout |
| `rowOpacity` | `Animated.Value`  | `1`             | Fades during height collapse                      |
| `isDeleting` | `useRef<boolean>` | `false`         | Guards against double-delete                      |

### Layout Measurement

Row height is captured via `onLayout` on the outermost `Animated.View` wrapper: `rowHeight.setValue(event.nativeEvent.layout.height)`. This update is skipped once `isDeleting.current` is `true`. The `64` fallback is an accepted trade-off for the rare race where delete fires before the first layout.

### Screen Width

Obtain via `Dimensions.get('window').width` at component top level. Portrait-locked, so this value is stable.

### Gesture Handler Wiring

The `PanGestureHandler` uses two separate callback props:

**`onGestureEvent`** — fires every frame during drag. Imperatively clamp and set `translateX`:

```ts
onGestureEvent={(e) => {
  if (isDeleting.current) return;
  const clamped = Math.max(e.nativeEvent.translationX, -screenWidth);
  translateX.setValue(Math.min(clamped, 0)); // no rightward movement
}}
```

Do NOT use `Animated.event` here — it does not support the clamping logic.

**`onHandlerStateChange`** — fires on state transitions. Check `nativeEvent.state`:

```ts
import { State } from 'react-native-gesture-handler';

onHandlerStateChange={(e) => {
  if (e.nativeEvent.state === State.END) {
    handleRelease(e.nativeEvent.translationX);
  }
  if (e.nativeEvent.state === State.CANCELLED || e.nativeEvent.state === State.FAILED) {
    springBack(); // same as below-threshold release
  }
}}
```

### Gesture Configuration

- `activeOffsetX={[-8, 8]}` and `failOffsetY={[-12, 12]}` give the vertical `ScrollView` priority.
- **Delete threshold:** `−80px`.

### During Drag

- Background `errorColor` is a hex string from theme (e.g. `#FF453A`). Use `#FF453A00` as the zero-alpha endpoint (append `00`) — not `"transparent"` — to avoid black-bleed in RN color interpolation.
- Background color interpolates: `translateX` `0 → −120` maps to `#FF453A00 → #FF453A`. Extends past the threshold so the background deepens during slide-out, confirming delete intent.
- Bin icon scale interpolates: `translateX` `0 → −80` maps to `1.0 → 1.15`, clamped.

### Bin Icon Layout and Tap Handling

The bin icon is rendered as a `NativeViewGestureHandler` wrapping a `Pressable` inside the row's background layer. This allows the tap to register correctly inside the `PanGestureHandler` without conflicts. It is absolutely positioned: `right: 0`, `top: 0`, `bottom: 0`, width `60`, centers the trash icon vertically. Tapping it calls the delete sequence directly (guarded by `isDeleting`). `accessibilityRole="button"`, `accessibilityLabel={t("exercise.removeSet")}`.

### On Release

**`springBack()`** (below threshold, cancelled, or failed):

```ts
Animated.spring(translateX, {
  toValue: 0,
  tension: 180,
  friction: 14,
  useNativeDriver: true,
}).start();
```

**Delete sequence** (at/past threshold or bin tap):

1. If `isDeleting.current` is `true`, return immediately.
2. Set `isDeleting.current = true`.
3. Run `translateX` on the native driver and `rowHeight` / `rowOpacity` on the JS driver as two separate concurrent calls (React Native throws if `Animated.parallel` mixes native and non-native drivers):

```ts
Animated.timing(translateX, {
  toValue: -screenWidth,
  duration: 200,
  useNativeDriver: true,
}).start();
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
```

Both groups start at `t=0`. `onRemove()` is called once the height/opacity group completes (~220ms).

Height animating to 0 causes surrounding rows to fill the gap naturally — no `LayoutAnimation` required.

### Unmount Safety

A `useEffect` with dependency array `[]` stops all animated values on unmount:

```ts
return () => {
  translateX.stopAnimation();
  rowHeight.stopAnimation();
  rowOpacity.stopAnimation();
};
```

---

## Files Changed

| File                                         | Change                                                             |
| -------------------------------------------- | ------------------------------------------------------------------ |
| `apps/mobile/app/workout.tsx`                | Animated progress bar width, remove padding                        |
| `apps/mobile/components/workout/set-row.tsx` | Replace `Swipeable` with `PanGestureHandler` custom implementation |
