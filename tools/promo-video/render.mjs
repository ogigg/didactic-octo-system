// Deterministic frame renderer: seeks the page timeline, captures frames,
// averages sub-frames in ffmpeg for real motion blur.
//
//   node render.mjs --stills 3.2,7.5 [--vertical] [--query theme=daylight] [--prefix f] [--cols 3]
//     → out/stills/<prefix>_<t>.png plus a labelled contact sheet out/stills/<prefix>_sheet.png
//   node render.mjs --video [--vertical] [--from 0 --to 30] [--fps 60 --sub 4] [--workers 7] [--crf 12] [--name video]
//     → out/<name>.mp4 (video only, no audio; make.mjs adds the soundtrack)
import puppeteer from "puppeteer-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
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

const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VERT = !!opt("vertical");
const W = VERT ? 1080 : 1920,
  H = VERT ? 1920 : 1080;
const page = opt("page", "index.html");
const query = [opt("query", ""), VERT ? "fmt=v" : ""].filter(Boolean).join("&");
const url = "file://" + path.join(here, page) + (query ? "?" + query : "");

async function openPage(browser) {
  const p = await browser.newPage();
  await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  p.on("console", (m) => {
    if (m.type() === "error") console.error("[page]", m.text());
  });
  p.on("pageerror", (e) => console.error("[pageerror]", e.message));
  await p.goto(url, { waitUntil: "load" });
  await p.waitForFunction("window.__ready === true", { timeout: 30000 });
  const cdp = await p.createCDPSession();
  return { p, cdp };
}

async function capture(cdp) {
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    optimizeForSpeed: true,
  });
  return Buffer.from(data, "base64");
}

const launch = () =>
  puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: [
      "--force-device-scale-factor=1",
      "--hide-scrollbars",
      "--disable-lcd-text",
      "--font-render-hinting=none",
      "--force-color-profile=srgb",
    ],
  });

if (opt("stills")) {
  const times = String(opt("stills")).split(",").map(Number);
  const outDir = path.join(here, opt("out", "out/stills"));
  fs.mkdirSync(outDir, { recursive: true });
  const b = await launch();
  const { p, cdp } = await openPage(b);
  const files = [];
  for (const t of times) {
    await p.evaluate((t) => {
      for (let x = 0; x < t; x += 1 / 30) window.renderAt(x, 0);
      window.renderAt(t, Math.round(t * 60));
    }, t);
    const buf = await capture(cdp);
    const f = path.join(outDir, `${opt("prefix", "f")}_${t.toFixed(2)}.png`);
    fs.writeFileSync(f, buf);
    files.push([f, t]);
    console.log(f);
  }
  await b.close();
  // contact sheet: thumbnails labelled with their time, `--cols` per row
  const cols = Number(opt("cols", VERT ? 5 : 3));
  const tw = VERT ? 360 : 640,
    th = VERT ? 640 : 360;
  const n = files.length;
  const inputs = files.flatMap(([f]) => ["-i", f]);
  const lab = files
    .map(
      ([, t], i) =>
        `[${i}:v]scale=${tw}:${th},drawtext=text='${t.toFixed(2)}s':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55[v${i}]`
    )
    .join(";");
  const layout = files
    .map((_, i) => `${(i % cols) * tw}_${Math.floor(i / cols) * th}`)
    .join("|");
  const sheet = path.join(outDir, `${opt("prefix", "f")}_sheet.png`);
  const graph =
    n > 1
      ? `${lab};${files.map((_, i) => `[v${i}]`).join("")}xstack=inputs=${n}:layout=${layout}:fill=black`
      : lab.replace(/\[v0\]$/, "");
  await new Promise((r) =>
    spawn(
      "ffmpeg",
      ["-loglevel", "error", "-y", ...inputs, "-filter_complex", graph, sheet],
      { stdio: "inherit" }
    ).on("close", r)
  );
  console.log(sheet);
  process.exit(0);
}

if (opt("video")) {
  const FPS = Number(opt("fps", 60));
  const SUB = Number(opt("sub", 4));
  const SHUTTER = Number(opt("shutter", 0.5)); // fraction of frame interval
  const from = Number(opt("from", 0));
  const to = Number(opt("to", 30));
  const workers = Number(opt("workers", 6));
  const crf = String(opt("crf", 12));
  const name = opt("name", "video");
  const f0 = Math.round(from * FPS),
    f1 = Math.round(to * FPS);
  const total = f1 - f0;
  const per = Math.ceil(total / workers);
  const segDir = path.join(here, "out", "seg_" + name);
  fs.rmSync(segDir, { recursive: true, force: true });
  fs.mkdirSync(segDir, { recursive: true });
  const t0 = Date.now();
  let done = 0;

  const runWorker = async (wi) => {
    const a = f0 + wi * per,
      z = Math.min(f1, a + per);
    if (a >= z) return null;
    const segFile = path.join(segDir, `seg_${String(wi).padStart(2, "0")}.mp4`);
    const vf =
      SUB > 1
        ? `tmix=frames=${SUB},select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/${FPS}/TB`
        : `setpts=N/${FPS}/TB`;
    const ff = spawn(
      "ffmpeg",
      [
        "-loglevel",
        "error",
        "-y",
        "-f",
        "image2pipe",
        "-framerate",
        String(FPS * SUB),
        "-c:v",
        "png",
        "-i",
        "-",
        "-vf",
        vf,
        "-r",
        String(FPS),
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        crf,
        "-pix_fmt",
        "yuv420p",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        "-colorspace",
        "bt709",
        segFile,
      ],
      { stdio: ["pipe", "inherit", "inherit"] }
    );
    const b = await launch();
    const { p, cdp } = await openPage(b);
    // warm-up: play the timeline up to the segment start so state matches sequential playback
    await p.evaluate((ta) => {
      for (let x = 0; x < ta; x += 1 / 30) window.renderAt(x, 0);
    }, a / FPS);
    for (let f = a; f < z; f++) {
      for (let k = 0; k < SUB; k++) {
        const t = f / FPS + (SUB > 1 ? (k / SUB) * (SHUTTER / FPS) : 0);
        await p.evaluate((t, f) => window.renderAt(t, f), t, f);
        const buf = await capture(cdp);
        if (!ff.stdin.write(buf))
          await new Promise((r) => ff.stdin.once("drain", r));
      }
      done++;
      if (done % 60 === 0) {
        const el = (Date.now() - t0) / 1000;
        process.stdout.write(
          `\r${done}/${total} frames  ${el.toFixed(0)}s  eta ${((el / done) * (total - done)).toFixed(0)}s   `
        );
      }
    }
    ff.stdin.end();
    await new Promise((r) => ff.on("close", r));
    await b.close();
    return segFile;
  };

  const segs = (
    await Promise.all(Array.from({ length: workers }, (_, i) => runWorker(i)))
  ).filter(Boolean);
  const list = path.join(segDir, "list.txt");
  fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join("\n"));
  const outFile = path.join(here, "out", `${name}.mp4`);
  await new Promise((r) =>
    spawn(
      "ffmpeg",
      [
        "-loglevel",
        "error",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        list,
        "-c",
        "copy",
        outFile,
      ],
      { stdio: "inherit" }
    ).on("close", r)
  );
  console.log(`\n${outFile}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  // puppeteer can leave sockets open after browser.close(); exit explicitly so make.mjs continues
  process.exit(0);
}
