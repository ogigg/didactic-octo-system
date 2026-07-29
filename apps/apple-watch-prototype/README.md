# Apple Watch Prototype

Interactive React prototypes for Apple Watch workout-logging layouts:

- **Set Pulse** — reps-first, optimized for the fastest possible set logging.
- **Split Console** — weight and reps together, optimized for precise adjustment.
- **Crown Forge (Grok 4.5)** — Digital Crown owns precision; mode switch + dial.
- **Tide Rest (Grok 4.5)** — work is a stamp; rest becomes a full-screen recovery tide.
- **Flick Ledger (Grok 4.5)** — gesture-first counting and logging, no steppers.
- **Set Orbit (Grok 4.5)** — spatial set progress with a gravitational current node.
- **Lone Signal (Grok 4.5)** — one adaptive number that changes with workout context.

All concepts share interactive reps, load, set completion, and rest-timer state.
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
