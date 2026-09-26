// Procedural soundtrack for the Sweaty ad: 120 BPM, 15 bars (30 s), Am–F–C–G.
// Pure JS synthesis → out/music.wav (48 kHz stereo, 16-bit).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const cues = JSON.parse(fs.readFileSync(path.join(here, "cues.json"), "utf8"));

const SR = 48000,
  LEN = 30.6,
  N = Math.ceil(SR * LEN);
const BEAT = 0.5,
  BAR = 2,
  S16 = 0.125;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- deterministic noise ----------
let seed = 1337;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rnd() * 2 - 1;

// ---------- buses ----------
const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const drums = bus(),
  music = bus(),
  fx = bus(),
  verbSend = bus(),
  delaySend = bus();
const put = (b, i, v, pan = 0) => {
  if (i < 0 || i >= N) return;
  const l = Math.cos(((pan + 1) * Math.PI) / 4),
    r = Math.sin(((pan + 1) * Math.PI) / 4);
  b.L[i] += v * l * 1.414;
  b.R[i] += v * r * 1.414;
};

// ---------- biquad ----------
class Biquad {
  constructor(type, f, q = 0.707) {
    this.type = type;
    this.q = q;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(f);
  }
  set(f, q = this.q) {
    f = Math.min(Math.max(f, 20), SR * 0.45);
    const w = (2 * Math.PI * f) / SR,
      c = Math.cos(w),
      s = Math.sin(w),
      a = s / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (this.type === "lp") {
      b0 = (1 - c) / 2;
      b1 = 1 - c;
      b2 = (1 - c) / 2;
    } else if (this.type === "hp") {
      b0 = (1 + c) / 2;
      b1 = -(1 + c);
      b2 = (1 + c) / 2;
    } else {
      b0 = a;
      b1 = 0;
      b2 = -a;
    } // bandpass (0 dB peak)
    a0 = 1 + a;
    a1 = -2 * c;
    a2 = 1 - a;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }
  p(x) {
    const y =
      this.b0 * x +
      this.b1 * this.x1 +
      this.b2 * this.x2 -
      this.a1 * this.y1 -
      this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

// polyBLEP saw
const blep = (t, dt) => {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
};
class Saw {
  constructor(f) {
    this.ph = rnd();
    this.f = f;
  }
  p() {
    const dt = this.f / SR;
    let v = 2 * this.ph - 1 - blep(this.ph, dt);
    this.ph += dt;
    if (this.ph >= 1) this.ph -= 1;
    return v;
  }
}

// ---------- instruments ----------
function kick(t, g = 1) {
  const i0 = Math.round(t * SR),
    len = Math.round(0.5 * SR);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const f = 44 + 120 * Math.exp(-tt * 38) + 40 * Math.exp(-tt * 200);
    ph += (2 * Math.PI * f) / SR;
    const env = Math.exp(-tt * 7.5) * Math.min(1, tt * 2000);
    let v = Math.tanh(Math.sin(ph) * 1.8) * env;
    if (tt < 0.004) v += noise() * 0.35 * (1 - tt / 0.004);
    put(drums, i0 + i, v * 0.9 * g);
  }
}
function clap(t, g = 1) {
  const i0 = Math.round(t * SR),
    len = Math.round(0.35 * SR);
  const bp = new Biquad("bp", 1400, 0.9),
    hp = new Biquad("hp", 500);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    let env = 0;
    for (const o of [0, 0.011, 0.022])
      if (tt >= o)
        env = Math.max(env, Math.exp(-(tt - o) * (o === 0.022 ? 18 : 120)));
    const v = hp.p(bp.p(noise())) * env * 1.6 * g;
    put(drums, i0 + i, v * 0.8, -0.05);
    put(verbSend, i0 + i, v * 0.35);
  }
}
function hat(t, g = 1, open = false) {
  const i0 = Math.round(t * SR),
    dec = open ? 9 : 55,
    len = Math.round((open ? 0.3 : 0.08) * SR);
  const hp = new Biquad("hp", 7500, 0.8),
    hp2 = new Biquad("hp", 9000, 0.7);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const v = hp2.p(hp.p(noise())) * Math.exp(-tt * dec) * g;
    put(drums, i0 + i, v * 0.32, 0.25);
  }
}
function snare(t, g = 1) {
  const i0 = Math.round(t * SR),
    len = Math.round(0.18 * SR);
  const bp = new Biquad("bp", 2200, 0.6);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const v =
      (Math.sin(2 * Math.PI * 190 * tt) * Math.exp(-tt * 40) * 0.6 +
        bp.p(noise()) * Math.exp(-tt * 22)) *
      g;
    put(drums, i0 + i, v * 0.5, 0.05);
    put(verbSend, i0 + i, v * 0.25);
  }
}
function bassNote(t, dur, m, g = 1) {
  const i0 = Math.round(t * SR),
    len = Math.round((dur + 0.05) * SR);
  const s1 = new Saw(mtof(m)),
    s2 = new Saw(mtof(m) * 1.004),
    lp = new Biquad("lp", 300, 1.1);
  const fsub = mtof(m - 12);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    if (i % 16 === 0) lp.set(180 + 900 * Math.exp(-tt * 14));
    const env =
      Math.min(1, tt * 400) * (tt > dur ? Math.exp(-(tt - dur) * 60) : 1);
    const v =
      (lp.p((s1.p() + s2.p()) * 0.5) * 0.7 +
        Math.sin(2 * Math.PI * fsub * tt) * 0.55) *
      env *
      g;
    put(music, i0 + i, v * 0.55);
  }
}
function padChord(t, dur, notes, g = 1, cutoff = 1800, pan = 0) {
  const i0 = Math.round(t * SR),
    rel = 0.8,
    len = Math.round((dur + rel) * SR);
  const oscs = [];
  notes.forEach((m, k) =>
    [-0.12, 0, 0.12].forEach((d, j) =>
      oscs.push({ o: new Saw(mtof(m + d)), pan: (j - 1) * 0.6 })
    )
  );
  const lpL = new Biquad("lp", cutoff, 0.8),
    lpR = new Biquad("lp", cutoff, 0.8);
  const c = typeof cutoff === "function" ? cutoff : () => cutoff;
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    if (i % 32 === 0) {
      const f = c(t + tt);
      lpL.set(f);
      lpR.set(f);
    }
    const env =
      Math.min(1, tt / 0.25) * (tt > dur ? Math.exp(-(tt - dur) * 5) : 1);
    let l = 0,
      r = 0;
    for (const { o, pan: p } of oscs) {
      const v = o.p();
      l += v * (1 - p) * 0.5;
      r += v * (1 + p) * 0.5;
    }
    const k = (0.09 * env * g) / notes.length;
    const L = lpL.p(l) * k,
      R = lpR.p(r) * k;
    const idx = i0 + i;
    if (idx < N) {
      music.L[idx] += L;
      music.R[idx] += R;
      verbSend.L[idx] += L * 0.6;
      verbSend.R[idx] += R * 0.6;
    }
  }
}
function pluck(t, m, g = 1, pan = 0, bright = 1) {
  const i0 = Math.round(t * SR),
    len = Math.round(0.4 * SR);
  const s = new Saw(mtof(m)),
    s2 = new Saw(mtof(m + 12) * 1.002),
    lp = new Biquad("lp", 3000, 1.4);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    if (i % 16 === 0) lp.set(400 + 4200 * bright * Math.exp(-tt * 22));
    const v =
      lp.p(s.p() * 0.6 + s2.p() * 0.3) *
      Math.exp(-tt * 9) *
      Math.min(1, tt * 800) *
      g;
    put(music, i0 + i, v * 0.22, pan);
    put(delaySend, i0 + i, v * 0.16, pan);
  }
}
function stab(t, notes, g = 1) {
  const i0 = Math.round(t * SR),
    len = Math.round(0.35 * SR);
  const oscs = [];
  notes.forEach((m) =>
    [-0.18, -0.06, 0.06, 0.18].forEach((d, j) =>
      oscs.push({ o: new Saw(mtof(m + d)), p: (j / 3) * 2 - 1 })
    )
  );
  const lpL = new Biquad("lp", 5000, 0.9),
    lpR = new Biquad("lp", 5000, 0.9);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    if (i % 16 === 0) {
      const f = 900 + 6000 * Math.exp(-tt * 12);
      lpL.set(f);
      lpR.set(f);
    }
    let l = 0,
      r = 0;
    for (const { o, p } of oscs) {
      const v = o.p();
      l += v * (1 - p) * 0.5;
      r += v * (1 + p) * 0.5;
    }
    const env =
      ((Math.exp(-tt * 7) * Math.min(1, tt * 600) * g * 0.07) / notes.length) *
      4;
    const idx = i0 + i;
    if (idx < N) {
      const L = lpL.p(l) * env,
        R = lpR.p(r) * env;
      music.L[idx] += L;
      music.R[idx] += R;
      verbSend.L[idx] += L * 0.5;
      verbSend.R[idx] += R * 0.5;
    }
  }
}
function bell(t, m, g = 1, pan = 0) {
  // simple FM bell
  const i0 = Math.round(t * SR),
    len = Math.round(2.5 * SR),
    f = mtof(m);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const mod = Math.sin(2 * Math.PI * f * 3.5 * tt) * 2.2 * Math.exp(-tt * 3);
    const v =
      Math.sin(2 * Math.PI * f * tt + mod) *
      Math.exp(-tt * 2.2) *
      Math.min(1, tt * 1500) *
      g;
    put(fx, i0 + i, v * 0.16, pan);
    put(verbSend, i0 + i, v * 0.12);
  }
}
function blip(t, g = 1, m = 96) {
  const i0 = Math.round(t * SR),
    len = Math.round(0.09 * SR),
    f = mtof(m);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const v =
      Math.sin(2 * Math.PI * (f + 300 * Math.exp(-tt * 60)) * tt) *
      Math.exp(-tt * 45) *
      Math.min(1, tt * 3000) *
      g;
    put(fx, i0 + i, v * 0.2, 0.15);
    put(verbSend, i0 + i, v * 0.05);
  }
}
function whoosh(t, dur = 0.5, g = 1, up = true) {
  const i0 = Math.round((t - dur * 0.7) * SR),
    len = Math.round(dur * SR);
  const bpL = new Biquad("bp", 500, 1.2),
    bpR = new Biquad("bp", 500, 1.2);
  for (let i = 0; i < len; i++) {
    const x = i / len;
    if (i % 32 === 0) {
      const f = up ? 300 * Math.pow(25, x) : 7000 * Math.pow(1 / 25, x);
      bpL.set(f);
      bpR.set(f * 1.1);
    }
    const env = Math.pow(Math.sin(Math.PI * Math.pow(x, 0.8)), 2) * g;
    const L = bpL.p(noise()) * env * 0.5,
      R = bpR.p(noise()) * env * 0.5;
    const idx = i0 + i;
    if (idx >= 0 && idx < N) {
      fx.L[idx] += L * (1 - x * 0.6);
      fx.R[idx] += R * (0.4 + x * 0.6);
      verbSend.L[idx] += L * 0.3;
      verbSend.R[idx] += R * 0.3;
    }
  }
}
function riser(t0, t1, g = 1) {
  const i0 = Math.round(t0 * SR),
    len = Math.round((t1 - t0) * SR);
  const bp = new Biquad("bp", 300, 2),
    bp2 = new Biquad("bp", 300, 2);
  const saw = new Saw(110);
  for (let i = 0; i < len; i++) {
    const x = i / len;
    if (i % 32 === 0) {
      bp.set(250 * Math.pow(40, x));
      bp2.set(260 * Math.pow(40, x));
      saw.f = 110 * Math.pow(4, x * x);
    }
    const env = Math.pow(x, 2.2) * g;
    put(fx, i0 + i, (bp.p(noise()) * 0.6 + saw.p() * 0.04) * env, -0.2);
    put(fx, i0 + i, bp2.p(noise()) * 0.6 * env, 0.2);
    put(verbSend, i0 + i, bp.p(noise()) * 0.2 * env);
  }
}
function impact(t, g = 1) {
  const i0 = Math.round(t * SR),
    len = Math.round(2.2 * SR);
  let ph = 0;
  const lp = new Biquad("lp", 5000, 0.7);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    const f = 34 + 90 * Math.exp(-tt * 18);
    ph += (2 * Math.PI * f) / SR;
    if (i % 32 === 0) lp.set(200 + 7000 * Math.exp(-tt * 5));
    const boom = Math.tanh(Math.sin(ph) * 2) * Math.exp(-tt * 2.2);
    const crash = lp.p(noise()) * Math.exp(-tt * 3.5) * 0.5;
    const v = (boom * 0.9 + crash) * g;
    put(fx, i0 + i, v * 0.8);
    put(verbSend, i0 + i, crash * 0.6 * g);
  }
}
function tick(t, g = 1) {
  // mechanical flap tick
  const i0 = Math.round(t * SR),
    len = Math.round(0.03 * SR);
  const bp = new Biquad("bp", 3200, 2);
  for (let i = 0; i < len; i++) {
    const tt = i / SR;
    put(
      fx,
      i0 + i,
      bp.p(noise()) * Math.exp(-tt * 250) * 0.9 * g,
      (rnd() - 0.5) * 0.6
    );
  }
}

// ---------- arrangement ----------
const CH = {
  Am: { root: 45, pad: [57, 60, 64, 67], arp: [69, 72, 76, 79] },
  F: { root: 41, pad: [53, 57, 60, 64], arp: [65, 69, 72, 76] },
  C: { root: 48, pad: [55, 60, 64, 67], arp: [67, 72, 76, 79] },
  G: { root: 43, pad: [55, 59, 62, 67], arp: [67, 71, 74, 79] },
  Cmaj9: { root: 48, pad: [55, 59, 62, 64, 67], arp: [72, 76, 79, 83] },
};
const bars = [
  "Am",
  "Am",
  "F",
  "C",
  "G",
  "Am",
  "F",
  "C",
  "G",
  "Am",
  "F",
  "C",
  "G",
  "F",
  "Cmaj9",
];

// intro pad (bar 0), filtered and swelling
padChord(0, 2, CH.Am.pad, 0.9, (t) => 400 + 900 * t);
riser(0.9, 2.0, 0.35);

for (let b = 1; b < 15; b++) {
  const t = b * BAR,
    ch = CH[bars[b]];
  const build = b === 8,
    drop = b === 9 || b === 10,
    end = b >= 13;
  // pad
  if (!end)
    padChord(
      t,
      BAR,
      ch.pad,
      drop ? 0.9 : 0.62,
      build ? (x) => 700 + 4000 * Math.pow((x - t) / BAR, 2) : 1600
    );
  // drums
  for (let k = 0; k < 4; k++) {
    const bt = t + k * BEAT;
    if (!end && !(build && k >= 2)) kick(bt, 1);
    if (b >= 3 && !end && !build && (k === 1 || k === 3)) clap(bt, 0.9);
    if (b >= 2 && !end && !build) {
      hat(bt + BEAT / 2, 0.9, b >= 5 && k % 2 === 1);
      if (b >= 5 || drop) {
        hat(bt + S16, 0.35);
        hat(bt + 3 * S16, 0.45);
      }
    }
  }
  // bass on offbeat 8ths (pumping)
  if (!end)
    for (let k = 0; k < 8; k++) {
      if (build && k >= 6) continue;
      const bt = t + (k * BEAT) / 2;
      if (k % 2 === 1 || drop)
        bassNote(bt, 0.2, ch.root, k % 2 === 1 ? 1 : 0.55);
    }
  // arp 16ths from bar 3
  if (b >= 3 && !end) {
    const pat = [0, 2, 1, 3, 2, 1, 3, 2];
    for (let k = 0; k < 16; k++) {
      if (build && k >= 12) continue;
      pluck(
        t + k * S16,
        ch.arp[pat[k % 8]] + (drop && k % 4 === 0 ? 12 : 0),
        k % 4 === 0 ? 1 : 0.7,
        k % 2 ? 0.35 : -0.35,
        drop ? 1.3 : 0.9
      );
    }
  }
  // drop stabs
  if (drop)
    for (const o of [0.25, 0.75, 1.25, 1.75])
      stab(
        t + o,
        ch.pad.map((m) => m + 12),
        1
      );
  // build: snare roll
  if (build) {
    for (let k = 0; k < 8; k++) snare(t + k * S16, 0.3 + k * 0.04);
    for (let k = 0; k < 16; k++) {
      const tt = t + 1 + (k * S16) / 2;
      if (tt < t + 1.75) snare(tt, 0.6 + k * 0.05);
    }
  }
}
// ending: F → Cmaj9 wash + bell arpeggio
padChord(26, 2, CH.F.pad, 0.7, 2000);
padChord(28, 2.2, CH.Cmaj9.pad, 0.6, (x) => 1900 - 500 * (x - 28));
bassNote(26, 1.8, CH.F.root, 0.8);
bassNote(28, 2.0, CH.C.root, 0.8);
[76, 79, 83, 84, 88].forEach((m, i) =>
  bell(28 + i * 0.125, m, 0.8 - i * 0.08, i % 2 ? 0.3 : -0.3)
);

// ---------- cues from the visual timeline ----------
for (const t of cues.impact || []) impact(t, 1);
for (const t of cues.hit || []) {
  kick(t, 0.9);
  impact(t, 0.35);
}
for (const t of cues.whoosh || []) whoosh(t, 0.55, 0.9);
for (const t of cues.whooshDown || []) whoosh(t, 0.5, 0.7, false);
for (const t of cues.blip || []) blip(t, 1);
for (const t of cues.blipLow || []) blip(t, 0.7, 88);
for (const t of cues.tick || []) tick(t, 0.8);
for (const [a, z] of cues.riser || []) riser(a, z, 1.0);
for (const [t, m] of cues.bell || []) bell(t, m, 0.9);
for (const [t, m] of cues.rep || []) {
  blip(t, 1, m);
  kick(t, 0.35);
}
for (const t of cues.pop || []) blip(t, 0.45, 100);
for (const t of cues.thud || []) {
  kick(t, 0.7);
  impact(t, 0.18);
}

// ---------- sidechain (kick ducks music) ----------
const duck = new Float32Array(N).fill(1);
const kickTimes = [];
for (let b = 1; b < 13; b++)
  for (let k = 0; k < 4; k++) {
    if (b === 8 && k >= 2) continue;
    kickTimes.push(b * BAR + k * BEAT);
  }
for (const kt of kickTimes) {
  const i0 = Math.round(kt * SR),
    len = Math.round(0.42 * SR);
  for (let i = 0; i < len && i0 + i < N; i++) {
    const x = i / len;
    duck[i0 + i] = Math.min(duck[i0 + i], 0.35 + 0.65 * Math.pow(x, 0.6));
  }
}

// ---------- effects ----------
// ping-pong delay (dotted 8th)
const dl = Math.round(0.375 * SR);
const dL = new Float32Array(N),
  dR = new Float32Array(N);
const dlp = new Biquad("lp", 3500),
  dlp2 = new Biquad("lp", 3500);
for (let i = 0; i < N; i++) {
  const inL = delaySend.L[i] + (i >= dl ? dR[i - dl] * 0.45 : 0);
  const inR = delaySend.R[i] + (i >= dl ? dL[i - dl] * 0.45 : 0);
  dL[i] = dlp.p(inL);
  dR[i] = dlp2.p(inR);
}
// Freeverb-ish
function freeverb(inp, spread) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map((d) => ({
    b: new Float32Array(d + spread),
    i: 0,
    f: 0,
  }));
  const aps = [556, 441, 341, 225].map((d) => ({
    b: new Float32Array(d + spread),
    i: 0,
  }));
  const out = new Float32Array(N),
    fb = 0.86,
    damp = 0.3;
  for (let n = 0; n < N; n++) {
    const x = inp[n] * 0.02;
    let y = 0;
    for (const c of combs) {
      const o = c.b[c.i];
      c.f = o * (1 - damp) + c.f * damp;
      c.b[c.i] = x + c.f * fb;
      c.i = (c.i + 1) % c.b.length;
      y += o;
    }
    for (const a of aps) {
      const o = a.b[a.i];
      const v = -y + o;
      a.b[a.i] = y + o * 0.5;
      a.i = (a.i + 1) % a.b.length;
      y = v;
    }
    out[n] = y;
  }
  return out;
}
const vL = freeverb(verbSend.L, 0),
  vR = freeverb(verbSend.R, 23);

// ---------- mix ----------
const outL = new Float32Array(N),
  outR = new Float32Array(N);
const hpL = new Biquad("hp", 28),
  hpR = new Biquad("hp", 28);
for (let i = 0; i < N; i++) {
  const d = duck[i];
  let l =
    drums.L[i] * 0.95 +
    music.L[i] * d +
    dL[i] * d * 0.8 +
    fx.L[i] * 0.9 +
    vL[i] * 1.6;
  let r =
    drums.R[i] * 0.95 +
    music.R[i] * d +
    dR[i] * d * 0.8 +
    fx.R[i] * 0.9 +
    vR[i] * 1.6;
  outL[i] = hpL.p(l);
  outR[i] = hpR.p(r);
}
// soft clip + normalize + fade out
let peak = 0;
for (let i = 0; i < N; i++) {
  outL[i] = Math.tanh(outL[i] * 1.25);
  outR[i] = Math.tanh(outR[i] * 1.25);
  peak = Math.max(peak, Math.abs(outL[i]), Math.abs(outR[i]));
}
const norm = 0.93 / peak;
const fadeStart = 29.2 * SR,
  fadeEnd = 30.0 * SR;
const buf = Buffer.alloc(44 + Math.round(30 * SR) * 4);
const NS = Math.round(30 * SR);
for (let i = 0; i < NS; i++) {
  const f =
    i < fadeStart
      ? 1
      : Math.max(0, 1 - (i - fadeStart) / (fadeEnd - fadeStart));
  const fi = i < 480 ? i / 480 : 1;
  buf.writeInt16LE(
    Math.round(Math.max(-1, Math.min(1, outL[i] * norm * f * fi)) * 32767),
    44 + i * 4
  );
  buf.writeInt16LE(
    Math.round(Math.max(-1, Math.min(1, outR[i] * norm * f * fi)) * 32767),
    44 + i * 4 + 2
  );
}
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + NS * 4, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(NS * 4, 40);
fs.mkdirSync(path.join(here, "out"), { recursive: true });
fs.writeFileSync(path.join(here, "out", "music.wav"), buf);
console.log("out/music.wav", peak.toFixed(2));
