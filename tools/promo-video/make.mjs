// One-shot build of the finished ad: soundtrack → frames → masters with audio.
//
//   node make.mjs [--format both|h|v] [--workers 7] [--draft] [--copy-to ~/Downloads]
//
//   --format   h = 1920×1080, v = 1080×1920 (Reels/TikTok), both (default)
//   --draft    30 fps, no motion blur: ~8× faster, for checking timing only
//   --copy-to  also copy the masters to this folder (never overwrites)
//
// Output: out/Sweaty_Ad_30s_<W>x<H>_master.mp4 (H.264, AAC 320k, -14 LUFS).
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf("--" + k);
  if (i < 0) return d;
  const v = argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};
const format = String(opt("format", "both"));
const workers = String(opt("workers", Math.max(1, os.cpus().length - 1)));
const draft = !!opt("draft");
const copyTo = opt("copy-to")
  ? String(opt("copy-to")).replace(/^~(?=\/|$)/, os.homedir())
  : null;
const out = (f) => path.join(here, "out", f);

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: here, stdio: "inherit" });
    p.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${cmd} ${args.join(" ")} exited with ${code}`))
    );
  });

for (const bin of ["ffmpeg", "ffprobe"]) {
  if (spawnSync("which", [bin]).status !== 0)
    throw new Error(`${bin} not found — install it with: brew install ffmpeg`);
}
if (!fs.existsSync(path.join(here, "node_modules", "puppeteer-core")))
  throw new Error("Run `npm install` in tools/promo-video first.");
fs.mkdirSync(path.join(here, "out"), { recursive: true });

// 1. soundtrack, loudness-normalised to -14 LUFS (two-pass loudnorm)
await run("node", ["music.mjs"]);
const probe = spawnSync(
  "ffmpeg",
  [
    "-hide_banner",
    "-i",
    out("music.wav"),
    "-af",
    "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json",
    "-f",
    "null",
    "-",
  ],
  { encoding: "utf8" }
);
const m = JSON.parse(
  probe.stderr.slice(
    probe.stderr.lastIndexOf("{"),
    probe.stderr.lastIndexOf("}") + 1
  )
);
await run("ffmpeg", [
  "-loglevel",
  "error",
  "-y",
  "-i",
  out("music.wav"),
  "-af",
  `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`,
  "-c:a",
  "pcm_s16le",
  out("music_norm.wav"),
]);

// 2. frames → video, 3. mux without re-encoding the picture
const targets = {
  h: { flag: [], size: "1920x1080" },
  v: { flag: ["--vertical"], size: "1080x1920" },
};
for (const key of format === "both" ? ["h", "v"] : [format]) {
  const t = targets[key];
  if (!t) throw new Error(`Unknown --format ${format}`);
  const name = `frames_${key}`;
  const quality = draft
    ? ["--fps", "30", "--sub", "1", "--crf", "18"]
    : ["--crf", "10"];
  await run("node", [
    "render.mjs",
    "--video",
    ...t.flag,
    "--workers",
    workers,
    "--name",
    name,
    ...quality,
  ]);
  const master = out(
    `Sweaty_Ad_30s_${t.size}_${draft ? "draft" : "master"}.mp4`
  );
  await run("ffmpeg", [
    "-loglevel",
    "error",
    "-y",
    "-i",
    out(`${name}.mp4`),
    "-i",
    out("music_norm.wav"),
    "-map",
    "0:v",
    "-map",
    "1:a",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "320k",
    "-movflags",
    "+faststart",
    "-t",
    "30",
    master,
  ]);
  console.log(`✓ ${master}`);
  if (copyTo) {
    const dest = path.join(copyTo, path.basename(master));
    if (fs.existsSync(dest))
      console.log(`  skipped copy: ${dest} already exists`);
    else {
      fs.copyFileSync(master, dest);
      console.log(`  copied to ${dest}`);
    }
  }
}
