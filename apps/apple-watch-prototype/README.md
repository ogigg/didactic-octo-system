# Apple Watch Prototype

React workspace for designing the Apple Watch workout experience.

The navigation is divided into two sections:

- **Final design** — an interactive six-screen flow: Exercise list, Active
  workout, Rest timer, Heart rate, Exercise complete, and Workout complete.
- **Ideas** — all 12 interactive layout explorations, preserved as reference
  material while the final flow is developed.

## Code layout

- `app/page.tsx` — gallery shell, sidebar, and the 12 idea concepts.
- `app/final-flow.tsx` — the final flow and its single simulated session.
- `app/watch-ui.tsx` — shared watch frame, simulated Digital Crown, and icons.

## Final flow behaviour

The final flow simulates one live session of seven exercises and keeps all of
its state in `FinalFlow`, so switching screens from the sidebar or from inside
the watch never resets progress.

- every exercise carries its own prescription, editable reps and load, logged
  sets, and elapsed time
- the active screen shows the plan target and the previous session's
  performance while a set is being edited
- logging a set starts rest, confirms with a toast, and offers an undo that
  restores the previous state
- rest can be paused, extended, and skipped, skipping asks for confirmation,
  and reaching zero shows an explicit _Start set_ action
- personal records are detected per exercise and surfaced in gold
- heart rate reacts to the workout state, drives recovery readiness, and the
  pulse animation cadence follows the displayed BPM
- the Digital Crown is simulated: drag, scroll, or arrow keys edit the active
  value on the workout screen, scroll the exercise list, and trim rest time

The idea concepts remain untouched and share their own interactive state.
The color palette is derived from `apps/mobile/constants/theme.ts`.
Canvas geometry is labelled in points at 1:1, so tap targets in the code are
sized in the same units.

## Run locally

From the repository root:

```bash
npm install
npm --workspace apple-watch-prototype run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Validate

```bash
npm --workspace apple-watch-prototype run check-types
npm --workspace apple-watch-prototype run build
```
