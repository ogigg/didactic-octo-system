---
name: app-promo-video
description: Make or change the Sweaty app promo video (a 30 s motion-graphics ad, 16:9 and 9:16 Reels) with the deterministic engine in tools/promo-video — new scenes, copy, timing, music, art direction or formats, then render full-quality MP4 masters locally. Use when the user asks for an ad, promo, teaser, Reels/TikTok/Shorts video or an app trailer, or to edit or re-render the existing one.
argument-hint: "[h|v|both] [draft]"
---

# /app-promo-video

The engine lives in [`tools/promo-video`](../../../tools/promo-video). Read its [README](../../../tools/promo-video/README.md) before editing. It covers the file roles, the scene timeline and the gotchas.

Arguments (`$ARGUMENTS`):

- `h`, `v` or `both` pick the format. `both` is the default.
- `draft` renders a fast 30 fps preview without motion blur.

## Hard rules

- **Nothing leaves the machine.** Never upload, post or publish the video: no Instagram, TikTok, YouTube, Linear, Slack, cloud drives or claude.ai uploads. Linear also has a 10 MB file limit.
  - Keep results in `tools/promo-video/out/`.
  - Copy to `~/Downloads` only when the user wants that, using `make.mjs --copy-to ~/Downloads`. It never overwrites.
  - To send a file into the chat, ask first.
- **Don't delete the user's files.** Move unwanted copies to `~/.Trash`, and only when asked.
- **A new look needs 4 options first.** A new art direction, restyle or new visual scene needs 4 style frames before settling. This is the team rule for visual tasks. The engine has 4 themes: `?theme=kinetic` (the user's pick on 2026-09-26, and the default), `midnight`, `daylight` and `electric`.
  - Render the same moments in each theme.
  - Show the contact sheets.
  - Let the user choose with AskUserQuestion.
- **App content must be real.** Pull copy from `apps/mobile/i18n/locales/en`, colours from `apps/mobile/constants/theme.ts` and screen structure from the actual components.
  - Don't invent features, pricing or store badges.
  - The app isn't publicly released, so the CTA is the landing page's "Be the first to train smarter".
- **Nothing is committed.** Changes to the engine go on a branch, and the user gets the git commands ([AGENTS.md](../../../AGENTS.md)). Rendered files in `out/` are gitignored.

## Workflow

1. **Setup.** Check for macOS, Google Chrome, Node and ffmpeg. Run `npm install` in `tools/promo-video` if `node_modules` is missing.
2. **Edit.** Scenes are in `index.html`, styles in `style.css` and animation in `main.js` (`build()` for the timeline, `procedural()` for per-frame state).
   - Cuts sit on 2 s bars at 120 BPM.
   - When an animation moves, move its sound effect in `cues.json` too. The musical arrangement is in `music.mjs`.
   - Any 9:16 change needs `portraitLayout()` and the `V ? … : …` values checked as well.
3. **Check with stills first.** They are fast, and each run writes a labelled contact sheet you can Read:

   ```bash
   cd tools/promo-video && node render.mjs --stills 2.6,10,12.6,19,24,28 --prefix check
   cd tools/promo-video && node render.mjs --stills 4.9,9.8,14.9,20.8,23.6 --vertical --prefix checkv
   ```

   Check transitions at their midpoints too. The iris is at about 3.7 s, the whip pan at 8.1, the wipe at 11.5, the zoom at 15.9, the flash at 18.1 and the collapse at 25.9.

4. **Draft.** Run `node make.mjs --draft --format v`. It takes about 1 minute and checks timing with audio.
5. **Masters.** Run `node make.mjs`, about 10 minutes per format. Use `run_in_background` and wait for the notification.
   - Output: `out/Sweaty_Ad_30s_1920x1080_master.mp4` and `out/Sweaty_Ad_30s_1080x1920_master.mp4`.
   - Encoding: H.264 CRF 10 at 60 fps, AAC 320k, -14 LUFS.
6. **Verify.** Run `ffprobe` (1800 frames, 30.0 s, audio present). Then pull a contact sheet of frames from the master with ffmpeg `select`+`tile` and look at it before reporting.

## Reporting

- Give the file paths, the resolution and fps, and the size.
- Say which scenes changed.
- Be clear that the soundtrack was checked only by waveform, spectrogram and loudness, not by listening.
