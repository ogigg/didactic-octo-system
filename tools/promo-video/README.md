# Sweaty promo video engine

This tool builds the 30-second Sweaty app ad as code: HTML/CSS scenes animated with GSAP, rendered frame by frame in headless Chrome, with a soundtrack synthesised in JavaScript.

It is deterministic. The randomness is seeded, the timeline is seeked rather than played, and the music is generated from code. The same sources give the same frames and the same audio.

The `/app-promo-video` skill (`.claude/skills/app-promo-video/SKILL.md`) drives this tool.

## Requirements

- **macOS.** The scenes use the system SF Pro, SF Pro Rounded and SF Mono fonts from `/System/Library/Fonts`.
- **Google Chrome** in `/Applications`. To use another Chromium, set `CHROME_PATH`.
- **Node 18+** and **ffmpeg** (`brew install ffmpeg`).
- Run `npm install` once in this folder. It is not an npm workspace.

## Commands

Run from `tools/promo-video`:

```bash
npm install
node render.mjs --stills 2.6,10,19,24 --prefix check            # PNG frames + labelled contact sheet
node render.mjs --stills 2.6,10,19,24 --vertical --prefix checkv # same for 9:16
node make.mjs --draft --format h                                 # fast 30 fps preview with audio
node make.mjs                                                    # both masters, 60 fps with motion blur
node make.mjs --copy-to ~/Downloads                              # masters + a copy (never overwrites)
```

Everything is written to `out/`, which is gitignored:

- `out/Sweaty_Ad_30s_1920x1080_master.mp4`
- `out/Sweaty_Ad_30s_1080x1920_master.mp4`

A full master takes about 10 minutes per format with 7 workers. That is 1800 frames, and each frame is 4 captures averaged into real motion blur.

To preview in a browser, open `index.html?play=1`. Add `&fmt=v` for 9:16, `&t=12` to start at 12 s, and `&theme=midnight|daylight|electric|kinetic` to pick an art direction. The default is `kinetic`.

## How it fits together

| File         | Role                                                                                                                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.html` | Markup for the stage and all 8 scenes: phones, widgets, Watch, Live Activity, share story, stats bento, end card.                                                                                                                                                        |
| `style.css`  | Art-direction themes, the app's design tokens (a copy of `apps/mobile/constants/theme.ts`, light and dark) and component styles.                                                                                                                                         |
| `main.js`    | Builds the GSAP timeline (`build()`) and the per-frame procedural layer (`procedural()`: counters, confetti, charts, camera shake, grain). Also holds the 9:16 layout (`portraitLayout()` plus `V ? … : …` values). The only entry point is `window.renderAt(t, frame)`. |
| `render.mjs` | Seeks the page and captures frames. Workers run in parallel, and ffmpeg's `tmix` averages 4 sub-frames per frame, with a 180° shutter, into motion blur.                                                                                                                 |
| `music.mjs`  | Synthesises the soundtrack: 120 BPM, Am–F–C–G, drop at 18 s. It includes sound effects placed from `cues.json`.                                                                                                                                                          |
| `cues.json`  | Sound-effect timestamps. Keep them in sync with the animations in `main.js`.                                                                                                                                                                                             |
| `make.mjs`   | Runs the soundtrack, the loudness pass (-14 LUFS), the render of both formats and the mux without re-encoding.                                                                                                                                                           |

Exercise thumbnails load straight from `supabase/assets/exercise-media`. The Anton display font is bundled in `assets/` under the SIL OFL (`assets/Anton-OFL.txt`).

## Timeline

Scene cuts land on bar lines. At 120 BPM one bar is 2 s.

| Time    | Scene                                                                                                                                            |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0–4 s   | The splash logo flies through its rings, then "STOP PLANNING." flips letter by letter to "START TRAINING." and an iris opens from the full stop. |
| 4–8 s   | Onboarding goal pick, preference chips, "Generating your workout…", then the plan.                                                               |
| 8–12 s  | Home tab in 3D with iOS widgets, "Start Workout" tap, brand-gradient wipe.                                                                       |
| 12–16 s | Logging sets on the beat, the rest timer, then phone + Watch + Live Activity.                                                                    |
| 16–18 s | Last set: "100 KG" fills with gold, one rep per beat, build-up.                                                                                  |
| 18–22 s | Drop: "New PR!", confetti and shockwave, then the share story.                                                                                   |
| 22–26 s | Progress bento with line chart, bars, heatmap and streak.                                                                                        |
| 26–30 s | Logo rings spring in, "Sweaty", "PLAN. TRAIN. PROGRESS.", CTA.                                                                                   |

## Gotchas

- **Keep everything a pure function of `t`.** Never use `Math.random()`, `Date` or CSS transitions or animations. Use the seeded `rnd()`/`hash()` and GSAP tweens on the paused timeline.
- **`fromTo` renders its "from" state immediately.** An element that is visible before its tween starts will jump. For things like the flash or the ping rings, use `tl.set(...)` followed by `tl.to(...)`, or pass `immediateRender: false`.
- **Masked text lines move by `yPercent: ±150`.** The masks have extra bottom padding for descenders. With smaller offsets, the next line peeks through.
- **Workers warm up by seeking from 0 to their first frame.** This keeps the state identical to sequential playback. Keep new state changes seekable.
- **In zsh, `"$var:l…"` is a modifier.** Write `${var}` when building ffmpeg filter strings in the shell.
- **Copy must match the app.** Strings come from `apps/mobile/i18n/locales/en`, and colours from `apps/mobile/constants/theme.ts`. When the app UI changes, update the matching scene.
