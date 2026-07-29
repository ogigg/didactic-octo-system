# Apple Watch Prototype

React workspace for designing the Apple Watch workout experience.

The navigation is divided into two sections:

- **Final design** — an interactive four-screen flow for the Exercise list,
  Active workout, Rest timer, and Heart rate screens.
- **Ideas** — all 12 interactive layout explorations, preserved as reference
  material while the final flow is developed.

The final flow supports navigating exercises within the current training,
rep and load adjustment, set logging, a recovery timer, and a focused live
heart-rate view. The idea concepts remain available as reference material and
share their original interactive state.
The color palette is derived from `apps/mobile/constants/theme.ts`.

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
