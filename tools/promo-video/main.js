/* Sweaty — 30s ad. Everything is a pure function of time t (seconds):
   GSAP drives transforms/opacity on a paused timeline, procedural() drives
   counters, particles, charts and camera. window.renderAt(t, frame) is the
   only entry point the renderer calls. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const Q = new URLSearchParams(location.search);
  const THEME = Q.get("theme") || "kinetic";
  const V = Q.get("fmt") === "v"; // vertical 9:16 (Reels)
  const SW = V ? 1080 : 1920,
    SH = V ? 1920 : 1080,
    CX = SW / 2,
    CY = SH / 2;
  if (V) document.documentElement.classList.add("fmt-v");
  const stage = $("#stage");
  stage.classList.add("theme-" + THEME);
  const LIGHT = THEME === "daylight" || THEME === "electric";
  if (LIGHT)
    $$(".ui-dark").forEach((e) => e.classList.replace("ui-dark", "ui-light"));
  const ACC = {
    midnight: ["#86CBF5", "#7F7CF7"],
    daylight: ["#3898D8", "#5E6EE0"],
    electric: ["#FFFFFF", "#DCEBFF"],
    kinetic: ["#5AAEE0", "#5AAEE0"],
  }[THEME];

  // ---------- deterministic random ----------
  let _s = 20260925;
  const rnd = () => {
    _s = (_s * 1664525 + 1013904223) >>> 0;
    return _s / 4294967296;
  };
  const hash = (n) => {
    let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const lerp = (a, b, x) => a + (b - a) * x;
  const ease = {
    o3: (x) => 1 - Math.pow(1 - x, 3),
    io3: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    o5: (x) => 1 - Math.pow(1 - x, 5),
    io2: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  };
  const P = (t, a, b, e = ease.o3) => e(clamp01((t - a) / (b - a)));
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (c1, c2, x) => {
    const a = hex(c1),
      b = hex(c2);
    return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], x))).join(",")})`;
  };
  const fmtT = (s) => {
    s = Math.max(0, Math.floor(s));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  // ---------- icons (SF Symbols look-alikes) ----------
  const I = {
    flame:
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12.9 2.3c.5 3.1-.9 4.8-2.5 6.6C8.8 10.7 7 12.6 7 15.5 7 18.9 9.3 21.5 12.2 21.5c3 0 5.3-2.4 5.3-5.8 0-2.3-1-4-2.2-5.3-.2 1.5-.9 2.5-1.9 3 .6-3.8-.1-7.6-.5-11.1z"/></svg>',
    clock:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
    dumbbell:
      '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1.5" y="9.3" width="2.6" height="5.4" rx="1"/><rect x="4.6" y="6.3" width="3.6" height="11.4" rx="1.3"/><rect x="15.8" y="6.3" width="3.6" height="11.4" rx="1.3"/><rect x="19.9" y="9.3" width="2.6" height="5.4" rx="1"/><rect x="8" y="10.7" width="8" height="2.6"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    chevR:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    chevD:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l7 7 7-7"/></svg>',
    timer:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="13.5" r="8"/><path d="M12 9.5v4l2.5 1.5M9.5 2.5h5"/></svg>',
    trophy:
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 3h12v5.5a6 6 0 0 1-12 0z"/><path d="M6 5H3.2v1.3A4.2 4.2 0 0 0 7 10.6M18 5h2.8v1.3A4.2 4.2 0 0 1 17 10.6" fill="none" stroke="currentColor" stroke-width="2"/><rect fill="currentColor" x="10.6" y="13.8" width="2.8" height="4.4"/><rect fill="currentColor" x="7" y="18" width="10" height="3.2" rx="1.2"/></svg>',
    house:
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.8l9.3 7.9V21h-6.4v-6.4H9.1V21H2.7V10.7z"/></svg>',
    calendar:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="5" width="17" height="15.5" rx="3.2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    person:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-5.8 7.5-5.8s6.5 1.8 7.5 5.8"/></svg>',
    heart:
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 21s-8.6-5.4-8.6-11.4A4.8 4.8 0 0 1 12 6.8a4.8 4.8 0 0 1 8.6 2.8C20.6 15.6 12 21 12 21z"/></svg>',
    question:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.9v.6"/><circle cx="12" cy="18.2" r=".7" fill="currentColor"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    fwd: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 6.5l8 5.5-8 5.5zM11 6.5l8 5.5-8 5.5z"/><rect x="19.2" y="6.5" width="2.2" height="11" rx="1"/></svg>',
    snow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/></svg>',
    spark:
      '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.8l2.3 7.9 7.9 2.3-7.9 2.3L12 22.2l-2.3-7.9L1.8 12l7.9-2.3z"/></svg>',
    status:
      '<svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M1.3 4.2a9.8 9.8 0 0 1 13.4 0M3.7 6.8a6.3 6.3 0 0 1 8.6 0M6.1 9.3a2.8 2.8 0 0 1 3.8 0"/></svg><svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.6" fill="none" stroke="currentColor" stroke-opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2.2" fill="currentColor"/><rect x="24.6" y="4.4" width="1.8" height="4.2" rx=".9" fill="currentColor" fill-opacity=".4"/></svg>',
  };

  // ---------- templates ----------
  const NEXTUP = `<div class="nextup">
    <div class="row sb"><span class="pill p"><i class="ico" data-i="flame"></i> Next up</span><span class="t-cap c2">Push</span></div>
    <div class="t-tmd" style="margin-top:12px">Push Day</div>
    <div class="row t-cap c2" style="gap:14px;margin-top:6px"><span><i class="ico" data-i="clock"></i> 45 min</span><span><i class="ico" data-i="dumbbell"></i> 6 exercises</span></div>
    <div class="hair"></div>
    <div class="exrow"><span class="t-bm">Barbell Bench Press</span><span class="t-cap c2">4×8</span></div>
    <div class="exrow"><span class="t-bm">Incline Dumbbell Press</span><span class="t-cap c2">3×10</span></div>
    <div class="exrow"><span class="t-bm">Cable Lateral Raise</span><span class="t-cap c2">3×12</span></div>
    <div class="t-cap c2" style="margin-top:4px">+3 more</div>
    <div class="btn nbtn" style="margin-top:16px">Start Workout</div></div>`;
  $$('[data-tpl="nextup"]').forEach((e) => (e.innerHTML = NEXTUP));

  const SETS = [
    [1, "77.5 kg × 8", "80", "8", "8"],
    [2, "77.5 kg × 8", "80", "8", "8"],
    [3, "77.5 kg × 7", "80", "8", "9"],
    [4, "95 kg × 5", "100", "5", "--"],
  ];
  $("#rows4").innerHTML = SETS.map(
    (s) =>
      `<div class="setrow" id="sr${s[0]}"><div class="rowbg"></div><span class="num">${s[0]}</span><span class="prev">${s[1]}</span><span class="inp">${s[2]}</span><span class="inp">${s[3]}</span><span class="inp">${s[4]}</span><span class="chk"><i class="ping"></i><i class="fill"><i class="ico" data-i="check"></i></i></span></div>`
  ).join("");

  // consistency grid (widget)
  $("#consGrid").innerHTML = Array.from({ length: 36 }, (_, i) => {
    const on = hash(i * 3.1) < 0.72 || i % 12 > 8;
    return `<i style="border-radius:4px;background:var(--w-acc);opacity:${on ? 0.25 + 0.75 * hash(i) : 0.1}" class="cg"></i>`;
  }).join("");

  // share story highlights
  $("#hl").innerHTML = [
    ["Barbell Bench Press", "Best: 100 kg × 5", 1, true],
    ["Incline Dumbbell Press", "Best: 32 kg × 10", 0.8],
    ["Cable Lateral Raise", "Best: 12 kg × 12", 0.62],
  ]
    .map(
      (h, i) =>
        `<div class="hlr" style="display:flex;gap:10px;align-items:center;margin-top:10px"><span style="width:22px;height:22px;border-radius:7px;background:#1E2530;color:#5AAEE0;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center">${i + 1}</span><div style="flex:1"><div style="font-size:12px;font-weight:600">${h[0]}</div><div style="font-size:10px;color:${h[3] ? "#FFC53D" : "#888"};margin-top:1px">${h[1]}${h[3] ? " · PR" : ""}</div><div style="height:3px;border-radius:2px;background:#2A2D30;margin-top:5px"><i style="display:block;height:100%;width:${h[2] * 100}%;border-radius:2px;background:${h[3] ? "#FFC53D" : "#5AAEE0"}"></i></div></div><span style="font-size:10px;font-weight:700;color:#30D158;background:rgba(48,209,88,.12);padding:3px 7px;border-radius:99px">3/3</span></div>`
    )
    .join("");

  // reps
  $("#reps").innerHTML = [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<div class="rep" style="position:relative;width:72px;height:72px;border-radius:50%;border:3px solid var(--ink3);display:flex;align-items:center;justify-content:center;font-family:SFR;font-weight:800;font-size:30px;color:var(--ink3)"><i class="repFill" style="position:absolute;inset:-3px;border-radius:50%;background:linear-gradient(135deg,#FFE9A8,#FFC53D 55%,#E3A50B);box-shadow:0 0 30px rgba(255,197,61,.6);opacity:0"></i><span style="position:relative" class="repN">${n}</span></div>`
    )
    .join("");

  // icons + status bars
  $$("[data-status]").forEach((e) => (e.innerHTML = I.status));
  $$("[data-i]").forEach((e) => (e.innerHTML = I[e.dataset.i] || ""));

  // camera wrapper (shake) around all scenes
  const cam = document.createElement("div");
  cam.id = "cam";
  cam.style.cssText = "position:absolute;inset:0;";
  $$(".scene").forEach((s) => cam.appendChild(s));
  stage.insertBefore(cam, $("#flash"));
  $$(".scene").forEach((s) => (s.style.perspective = "2400px"));

  // wipe overlay for S3 → S4
  const wipe = document.createElement("div");
  wipe.id = "wipe";
  wipe.style.cssText =
    "position:absolute;left:0;top:0;background:linear-gradient(135deg,#3898D8 0%,#4A86DC 50%,#5E6EE0 100%);border-radius:14px;opacity:0;visibility:hidden;";
  wipe.classList.add(LIGHT ? "ui-light" : "ui-dark");
  stage.insertBefore(wipe, $("#flash"));

  // background rings
  const bgR = $("#bgRings");
  bgR.innerHTML = Array.from(
    { length: 12 },
    (_, i) => `<circle cx="0" cy="0" r="${180 + i * 130}"/>`
  ).join("");

  // ---------- headlines ----------
  const headline = (el, lines) => {
    el.innerHTML = lines
      .map(
        (l) =>
          `<div class="mline" style="overflow:hidden;padding:0.04em 0.05em 0.24em;margin:-0.04em -0.05em -0.24em"><div class="mi">${l}</div></div>`
      )
      .join("");
    return $$(".mi", el);
  };
  const A = (s) => `<span class="acc">${s}</span>`;
  const K = THEME === "kinetic";
  const h2a = headline($("#s2h1"), ["Set your", A("goals once.")]);
  const h2b = headline($("#s2h2"), ["Get a plan", A("built for you.")]);
  const h3 = headline($("#s3h1"), [
    "Your workout",
    "is already",
    A("waiting."),
  ]);
  const h4 = headline($("#s4h1"), ["One tap.", A("Set logged.")]);
  const h6 = headline(
    $("#prHead"),
    V
      ? ["New personal", `<span style="color:var(--gold)">record.</span>`]
      : ["New personal " + `<span style="color:var(--gold)">record.</span>`]
  );
  const h7 = headline($("#s7h1"), ["Watch", "yourself get", A("stronger.")]);
  const h6b = document.createElement("div");
  h6b.className = "disp abs";
  h6b.style.cssText = V
    ? "left:0;width:1080px;text-align:center;top:395px;font-size:108px;line-height:1.02"
    : "left:150px;top:600px;font-size:104px;line-height:1.02";
  $("#s6").appendChild(h6b);
  const h6bl = headline(h6b, [
    "Every PR,",
    `<span style="color:var(--gold)">celebrated.</span>`,
  ]);

  // hook letters
  const letters = (el, parts) => {
    el.innerHTML = parts
      .map(([txt, kind]) =>
        [...txt]
          .map((c, i) => {
            let color = "var(--ink)";
            if (kind === "dim") color = "var(--ink3)";
            if (kind === "acc")
              color = mix(ACC[0], ACC[1], i / Math.max(1, txt.length - 1));
            return `<span class="ch${kind === "dot" ? " dotch" : ""}" style="color:${kind === "dot" ? ACC[1] : color}${c === " " && V ? ";display:block;height:0" : ""}">${c === " " ? (V ? "" : "&nbsp;") : c}</span>`;
          })
          .join("")
      )
      .join("");
    return $$(".ch", el);
  };
  const LA = letters($("#lineA"), [
    ["Stop", ""],
    [" ", ""],
    ["planning.", "dim"],
  ]);
  const LB = letters($("#lineB"), [
    ["Start", ""],
    [" ", ""],
    ["training", "acc"],
    [".", "dot"],
  ]);

  // intro fly-through rings + S8 logo
  const PAL = ["#3898D8", "#57A9E1", "#7FBFEA", "#BCDFF7"];
  const SIZES = [170, 122, 82, 46];
  const fly = $("#flyRings");
  fly.innerHTML =
    `<div class="flyH" style="position:absolute;left:50%;top:50%;width:118px;height:108px;margin:-116px 0 0 -59px;border-radius:54px;border:27px solid ${PAL[0]}"></div>` +
    SIZES.map(
      (s, i) =>
        `<div class="flyRing" style="width:${s}px;height:${s}px;margin:${-s / 2 + 31}px 0 0 ${-s / 2}px;background:${PAL[i]}"></div>`
    ).join("");
  SIZES.forEach((s, i) => {
    const r = $("#lr" + i);
    r.style.cssText = `width:${s}px;height:${s}px;top:${62 + (170 - s) / 2}px;left:${(170 - s) / 2}px;background:${PAL[i]}`;
  });
  $("#logo").style.margin = "-116px 0 0 -85px";
  $("#endRings").innerHTML = Array.from(
    { length: 6 },
    (_, i) =>
      `<div class="er" style="position:absolute;left:${CX}px;top:${V ? 700 : 330}px;width:400px;height:400px;margin:-200px 0 0 -200px;border-radius:50%;border:2px solid var(--acc);opacity:0"></div>`
  ).join("");

  // floating chips (S2)
  const CHIPS = V
    ? [
        ["trophy", "Build muscle", 830, 690],
        ["dumbbell", "Full gym", 870, 930],
        ["calendar", "4 days a week", 260, 1420],
        ["clock", "45 min", 200, 1160],
        ["person", "Intermediate", 240, 770],
      ]
    : [
        ["trophy", "Build muscle", 1700, 250],
        ["dumbbell", "Full gym", 1740, 540],
        ["calendar", "4 days a week", 1680, 830],
        ["clock", "45 min", 1000, 900],
        ["person", "Intermediate", 1010, 190],
      ];
  const G2 = V ? [540, 1165] : [1290, 540];
  const PR = V ? [540, 720] : [960, 470];
  $("#chips").innerHTML = CHIPS.map(
    ([ic, label, x, y]) =>
      `<div class="fcw abs" style="left:${x}px;top:${y}px"><div class="fchip" style="transform:translate(-50%,-50%)"><span class="fi">${I[ic]}</span>${label}</div></div>`
  ).join("");
  $$(".fchip .fi svg").forEach((s) => {
    s.style.width = "26px";
    s.style.height = "26px";
  });

  // shocks + confetti
  $("#shocks").innerHTML = [0, 1, 2]
    .map(
      () =>
        `<div class="shock" style="left:${PR[0]}px;top:${PR[1]}px;width:200px;height:200px;margin:-100px 0 0 -100px"></div>`
    )
    .join("");
  const CF_COLORS = [
    "#FFD700",
    "#FFC53D",
    "#E3A50B",
    "#FFE08A",
    "#FFB300",
    "#FFF3C4",
    "#FFFFFF",
    "#5AAEE0",
  ];
  const CONF = [];
  const cfWrap = $("#confetti");
  for (let i = 0; i < 190; i++) {
    const burst = i < 140;
    const circle = rnd() < 0.4;
    const w = 10 + rnd() * 14,
      h = circle ? w : 6 + rnd() * 10;
    const el = document.createElement("i");
    el.className = "cf";
    el.style.cssText = `width:${w}px;height:${h}px;background:${CF_COLORS[Math.floor(rnd() * CF_COLORS.length)]};border-radius:${circle ? "50%" : "2px"};`;
    cfWrap.appendChild(el);
    const ang = rnd() * Math.PI * 2,
      sp = 700 + rnd() * 1700;
    CONF.push({
      el,
      burst,
      x0: burst ? PR[0] : rnd() * SW,
      y0: burst ? PR[1] : -60 - rnd() * 200,
      vx: burst ? Math.cos(ang) * sp : (rnd() - 0.5) * 140,
      vy: burst ? Math.sin(ang) * sp - 500 : 250 + rnd() * 200,
      delay: burst ? rnd() * 0.06 : 0.25 + rnd() * 0.6,
      rot: rnd() * 360,
      spin: (rnd() - 0.5) * 900,
      flip: 4 + rnd() * 10,
      sway: rnd() * 6.28,
    });
  }

  // heatmap
  const HM = [];
  const heat = $("#heat");
  for (let c = 0; c < 26; c++)
    for (let r = 0; r < 7; r++) {
      const e = document.createElement("i");
      heat.appendChild(e);
      const p = hash(c * 7 + r + 0.5);
      const density = 0.18 + (c / 26) * 0.4;
      const lvl =
        p < density
          ? p < density * 0.25
            ? 4
            : p < density * 0.5
              ? 3
              : p < density * 0.75
                ? 2
                : 1
          : 0;
      HM.push({ e, c, r, lvl });
    }

  // bars
  const VOLS = [6.2, 7.0, 5.8, 7.9, 8.4, 7.6, 9.1, 9.8, 8.9, 10.4, 11.2, 12.4];
  $("#bars").innerHTML = VOLS.map(
    (v, i) =>
      `<div class="bar" style="flex:1;height:${(v / 12.4) * 100}%;border-radius:6px 6px 3px 3px;background:var(--p-primary);opacity:${i === 11 ? 1 : 0.55};transform-origin:bottom"></div>`
  ).join("");

  // line chart
  const DATA = [80, 82.5, 82.5, 85, 87.5, 87.5, 90, 92.5, 92.5, 95, 97.5, 100];
  const DATES = [
    "Jul 10",
    "Jul 17",
    "Jul 24",
    "Jul 31",
    "Aug 7",
    "Aug 14",
    "Aug 21",
    "Aug 28",
    "Sep 4",
    "Sep 11",
    "Sep 18",
    "Sep 25",
  ];
  const CW = 580,
    CH = 250;
  const pts = DATA.map((v, i) => [
    12 + i * ((CW - 24) / 11),
    225 - ((v - 76) / (102 - 76)) * 195,
  ]);
  const smooth = (p) => {
    let d = `M${p[0][0]},${p[0][1]}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i],
        p1 = p[i],
        p2 = p[i + 1],
        p3 = p[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
        c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
    }
    return d;
  };
  const lineD = smooth(pts);
  const primary = LIGHT ? "#3898D8" : "#5AAEE0";
  const surface = LIGHT ? "#FFFFFF" : "#1A1D20";
  $("#lineChart").innerHTML = `<defs>
      <linearGradient id="lg" x1="0" x2="1"><stop offset="0" stop-color="${primary}"/><stop offset="1" stop-color="${LIGHT ? "#5E6EE0" : "#7B78F5"}"/></linearGradient>
      <linearGradient id="la" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${primary}" stop-opacity=".30"/><stop offset=".6" stop-color="${primary}" stop-opacity=".08"/><stop offset="1" stop-color="${primary}" stop-opacity="0"/></linearGradient>
      <clipPath id="lc"><rect id="lcr" x="0" y="-20" width="0" height="300"/></clipPath></defs>
    ${[0, 1, 2, 3].map((k) => `<line x1="0" x2="${CW}" y1="${30 + k * 65}" y2="${30 + k * 65}" stroke="var(--p-border)" stroke-width="1"/>`).join("")}
    <path d="${lineD} L${pts[11][0]},${CH} L${pts[0][0]},${CH} Z" fill="url(#la)" clip-path="url(#lc)"/>
    <path id="lp" d="${lineD}" fill="none" stroke="url(#lg)" stroke-width="4" stroke-linecap="round"/>
    <g id="xh" opacity="0"><line id="xhl" x1="0" x2="0" y1="0" y2="${CH}" stroke="var(--p-text2)" stroke-width="1.5" stroke-dasharray="3 4"/>
      <circle id="xhh" r="14" fill="${primary}" fill-opacity=".16"/><circle id="xhd" r="7" fill="${primary}" stroke="${surface}" stroke-width="3"/></g>`;
  const lp = $("#lp");
  const LEN = lp.getTotalLength();
  lp.style.strokeDasharray = LEN;
  lp.style.strokeDashoffset = LEN;
  const LUT = Array.from({ length: 700 }, (_, i) => {
    const p = lp.getPointAtLength((i / 699) * LEN);
    return [p.x, p.y];
  });
  const yAtX = (x) => {
    let lo = 0,
      hi = LUT.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (LUT[m][0] < x) lo = m;
      else hi = m;
    }
    const a = LUT[lo],
      b = LUT[hi];
    return lerp(a[1], b[1], clamp01((x - a[0]) / (b[0] - a[0] || 1)));
  };

  // kinetic theme: giant outline words
  let BGW_DIR = 0;
  if (K) {
    [
      ["#s2k", "01 — Set it once"],
      ["#s3k", "02 — Every morning"],
      ["#s4k", "03 — In the gym"],
      ["#s7k", "04 — Over time"],
    ].forEach(([s, txt]) => ($(s).textContent = txt));
    [
      ["#s2", "PLAN"],
      ["#s3", "READY"],
      ["#s4", "LOG IT"],
      ["#s6", "NEW PR"],
      ["#s7", "PROGRESS"],
      ["#s8", "SWEATY"],
    ].forEach(([s, w]) => {
      const d = document.createElement("div");
      d.className = "bgword";
      d.dataset.dir = BGW_DIR++ % 2 ? "1" : "-1";
      d.textContent = (w + "  ").repeat(4);
      d.style.cssText =
        "position:absolute;top:50%;left:0;margin-top:-300px;font-family:Anton;font-size:560px;line-height:600px;white-space:nowrap;color:transparent;-webkit-text-stroke:2px rgba(245,245,242,.07);";
      $(s).prepend(d);
    });
  }

  // grain texture
  const gc = $("#grain");
  const GW = V ? 600 : 1024,
    GH = V ? 1024 : 600;
  gc.width = GW;
  gc.height = GH;
  gc.style.cssText += `;width:${GW * 2}px;height:${GH * 2}px;left:-64px;top:-64px;inset:auto;`;
  {
    const g = gc.getContext("2d");
    const im = g.createImageData(GW, GH);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = rnd() * 255;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
      im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }

  const LOGO_S = V ? 2.2 : 2.0,
    LOGO_Y = V ? -260 : -210;

  // vertical 9:16 layout — keeps copy inside the Reels safe zone (top ~250px, bottom ~420px, right rail)
  function portraitLayout() {
    if (!V) return;
    const S = (sel, css) => Object.assign($(sel).style, css);
    $$(".hookLine").forEach((e) => {
      e.style.fontSize = "215px";
      e.style.marginTop = "-198px";
    });
    S("#hookSub", { marginTop: "245px", padding: "0 80px" });
    ["#s2copy", "#s3copy", "#s4copy", "#s7copy"].forEach((c) =>
      S(c, { left: "0px", top: "300px", width: "1080px", textAlign: "center" })
    );
    S("#s2h2", { left: "0px", right: "0px" });
    ["#s2h1", "#s2h2", "#s3h1", "#s4h1", "#s7h1"].forEach(
      (h) => ($(h).style.fontSize = "128px")
    );
    S("#g2", { left: "540px", top: "1165px" });
    S("#g3", { left: "540px", top: "1200px" });
    S("#s3sub", { display: "none" });
    const wpos = {
      "#wNext": [200, 870, 338],
      "#wStreak": [885, 900, 158],
      "#wWeek": [885, 1110, 158],
      "#wCons": [200, 1110, 338],
    };
    Object.entries(wpos).forEach(([sel, [x, y, w]]) =>
      S(sel, { left: `${x - 540 - w / 2}px`, top: `${y - 1200 - 79}px` })
    );
    S("#g4", { left: "540px", top: "1170px" });
    S("#s4cap", {
      top: "330px",
      left: "90px",
      right: "90px",
      whiteSpace: "normal",
      lineHeight: "1.3",
    });
    S("#s5k", { top: "560px" });
    S("#bigNum", { top: "640px" });
    S("#reps", { top: "1130px" });
    S("#s5sub", { top: "1250px" });
    S("#prWrap", { left: `${PR[0]}px`, top: `${PR[1]}px` });
    S("#prHead", { top: "900px", fontSize: "132px" });
    S("#g7", { left: "540px", top: "1130px" });
    S("#wordmark", { top: "1000px" });
  }

  // ======================================================================
  // measure layout (before any transforms) — local coordinates in screens
  // ======================================================================
  const local = (el, root) => {
    const a = el.getBoundingClientRect(),
      b = root.getBoundingClientRect();
    return {
      x: a.left - b.left + a.width / 2,
      y: a.top - b.top + a.height / 2,
      w: a.width,
      h: a.height,
    };
  };
  let M = {};
  function measure() {
    $$(".scene").forEach((s) => (s.style.visibility = "visible"));
    const scr2 = $("#ph2 .screen"),
      scr3 = $("#ph3 .screen"),
      scr4 = $("#ph4 .screen");
    M.opt = local($("#optSel"), scr2);
    M.obBtn = local($("#obBtn"), scr2);
    M.nbtn3 = local($("#nu3 .nbtn"), scr3);
    M.chk = [1, 2, 3, 4].map((n) => local($(`#sr${n} .chk`), scr4));
    const d = $(".dotch", $("#lineB")).getBoundingClientRect();
    M.dot = {
      x: d.left + d.width / 2,
      y: d.top + d.height * 0.78,
      r: d.width * 0.28,
    };
    $$(".scene").forEach((s) => (s.style.visibility = ""));
  }

  // ======================================================================
  // timeline
  // ======================================================================
  const tl = gsap.timeline({ paused: true, defaults: { ease: "power3.out" } });
  const show = (sel, a, b) => {
    tl.set(sel, { visibility: "visible" }, a);
    if (b != null) tl.set(sel, { visibility: "hidden" }, b);
  };
  const rise = (els, t, d = 0.75, st = 0.08) =>
    tl.fromTo(
      els,
      { yPercent: 150 },
      { yPercent: 0, duration: d, ease: "expo.out", stagger: st },
      t
    );
  const sink = (els, t, d = 0.4, st = 0.04) =>
    tl.to(
      els,
      { yPercent: -150, duration: d, ease: "power3.in", stagger: st },
      t
    );
  const fadeUp = (el, t, d = 0.6, y = 30) =>
    tl.fromTo(
      el,
      { opacity: 0, y },
      { opacity: 1, y: 0, duration: d, ease: "power3.out" },
      t
    );
  const tap = (el, x, y, t) => {
    tl.set(el, { left: x, top: y }, t - 0.12);
    tl.fromTo(
      el,
      { opacity: 0, scale: 1.5 },
      { opacity: 1, scale: 1, duration: 0.12, ease: "power2.out" },
      t - 0.12
    );
    tl.to(el, { scale: 0.8, duration: 0.08, ease: "power2.in" }, t);
    tl.to(
      el,
      { opacity: 0, scale: 1.3, duration: 0.25, ease: "power2.out" },
      t + 0.08
    );
  };

  function build() {
    // ---------------- background glows ----------------
    gsap.set(["#glowA", "#glowB", "#glowC", "#glowGold"], { x: 0, y: 0 });
    const OX = SW * 0.1,
      OY = SH * 0.1;
    const G = (t, a, b, c) => {
      tl.to(
        "#glowA",
        {
          left: a[0] + OX,
          top: a[1] + OY,
          opacity: a[2],
          duration: 1.0,
          ease: "power2.inOut",
        },
        t
      );
      tl.to(
        "#glowB",
        {
          left: b[0] + OX,
          top: b[1] + OY,
          opacity: b[2],
          duration: 1.0,
          ease: "power2.inOut",
        },
        t
      );
      if (c)
        tl.to(
          "#glowC",
          {
            left: c[0] + OX,
            top: c[1] + OY,
            opacity: c[2],
            duration: 1.0,
            ease: "power2.inOut",
          },
          t
        );
    };
    const GL = V
      ? {
          init: [
            [540, 960, 0.35],
            [900, 300, 0.25],
            [150, 1600, 0.3],
          ],
          gold: [540, 760],
          keys: [
            [1.6, [540, 960, 0.75], [950, 250, 0.5], [120, 1700, 0.4]],
            [3.6, [540, 1130, 0.9], [150, 1700, 0.55], [950, 250, 0.35]],
            [7.7, [540, 1180, 0.85], [950, 300, 0.6], [120, 1700, 0.3]],
            [11.7, [540, 1150, 0.8], [950, 1700, 0.5], [120, 300, 0.3]],
            [13.9, [540, 1000, 0.85], [150, 300, 0.45], [950, 1600, 0.4]],
            [15.9, [540, 900, 0.35], [540, 1600, 0.2], [540, 300, 0.1]],
            [21.7, [540, 1100, 0.8], [150, 1600, 0.55], [950, 250, 0.35]],
            [25.7, [540, 700, 0.95], [540, 1500, 0.55], [200, 300, 0.3]],
          ],
        }
      : {
          init: [
            [960, 540, 0.35],
            [1600, 200, 0.25],
            [300, 900, 0.3],
          ],
          gold: [960, 480],
          keys: [
            [1.6, [960, 560, 0.75], [1650, 180, 0.5], [250, 950, 0.4]],
            [3.6, [1290, 520, 0.9], [300, 900, 0.55], [1700, 150, 0.35]],
            [7.7, [720, 560, 0.85], [1650, 250, 0.6], [200, 950, 0.3]],
            [11.7, [700, 540, 0.8], [1600, 900, 0.5], [200, 200, 0.3]],
            [13.9, [960, 520, 0.85], [300, 250, 0.45], [1650, 850, 0.4]],
            [15.9, [960, 460, 0.35], [960, 900, 0.2], [960, 200, 0.1]],
            [21.7, [1290, 520, 0.8], [250, 850, 0.55], [1650, 150, 0.35]],
            [25.7, [960, 330, 0.95], [960, 950, 0.55], [300, 300, 0.3]],
          ],
        };
    ["#glowA", "#glowB", "#glowC"].forEach((g, i) =>
      gsap.set(g, {
        left: GL.init[i][0] + OX,
        top: GL.init[i][1] + OY,
        opacity: GL.init[i][2],
      })
    );
    gsap.set("#glowGold", { left: GL.gold[0] + OX, top: GL.gold[1] + OY });
    GL.keys.forEach(([t, a, b, c]) => G(t, a, b, c));
    tl.fromTo(
      "#glowGold",
      { opacity: 0, scale: 0.6 },
      { opacity: 0.85, scale: 1.1, duration: 1.9, ease: "power2.in" },
      16.0
    );
    tl.to(
      "#glowGold",
      { opacity: 1, scale: 1.4, duration: 0.3, ease: "power2.out" },
      18.0
    );
    tl.to(
      "#glowGold",
      { opacity: 0.35, scale: 1.0, duration: 1.8, ease: "power2.inOut" },
      18.6
    );
    tl.to("#glowGold", { opacity: 0, duration: 0.6 }, 21.6);
    gsap.set("#bgRings", { left: "50%", top: "50%", opacity: 0.9 });
    tl.to("#bgRings", { opacity: 0.25, duration: 1 }, 3.6);
    tl.to("#bgRings", { opacity: 1, duration: 1 }, 25.8);

    // ---------------- S1 hook (0–4) ----------------
    show("#s1", 0, 4.15);
    const fr = $$(".flyRing"),
      fh = $(".flyH");
    gsap.set("#flyRings", { scale: 1.7, transformOrigin: `${CX}px ${CY}px` });
    gsap.set("#flyRings", {
      left: 0,
      top: 0,
      position: "absolute",
      width: SW,
      height: SH,
    });
    tl.fromTo(
      "#flyRings",
      { scale: 1.6 },
      { scale: 1.75, duration: 0.3, ease: "none" },
      0
    );
    tl.to(fh, { y: 40, opacity: 0, duration: 0.22, ease: "power2.in" }, 0.12);
    fr.forEach((r, i) =>
      tl.to(
        r,
        { scale: 30 - i * 3, duration: 0.5, ease: "power3.in" },
        0.24 + i * 0.06
      )
    );
    tl.set("#flyRings", { visibility: "hidden" }, 0.95);

    const [stop, sp, ...plan] = LA;
    gsap.set(LA, { transformPerspective: 900 });
    const slam = (els, t) =>
      tl.fromTo(
        els,
        { opacity: 0, scale: 1.7, filter: "blur(26px)" },
        {
          opacity: 1,
          scale: 1,
          filter: "blur(0px)",
          duration: 0.42,
          ease: "expo.out",
          stagger: 0.012,
        },
        t
      );
    slam(LA.slice(0, 4), 0.7);
    slam(LA.slice(5), 1.2);
    tl.fromTo(
      "#lineA",
      { scale: 1 },
      { scale: 1.035, duration: 1.4, ease: "none" },
      0.7
    );
    // flip: letters roll over to "Start training."
    tl.to(
      LA,
      {
        yPercent: -90,
        rotationX: 85,
        opacity: 0,
        duration: 0.32,
        ease: "power3.in",
        stagger: 0.022,
      },
      1.92
    );
    gsap.set(LB, { transformPerspective: 900 });
    tl.fromTo(
      LB,
      { yPercent: 90, rotationX: -85, opacity: 0 },
      {
        yPercent: 0,
        rotationX: 0,
        opacity: 1,
        duration: 0.55,
        ease: "expo.out",
        stagger: 0.022,
      },
      2.0
    );
    tl.fromTo(
      "#lineB",
      { scale: 1.035 },
      { scale: 1.08, duration: 1.5, ease: "none" },
      2.0
    );
    fadeUp("#hookSub", 2.45, 0.7);
    tl.to(
      "#hookSub",
      { opacity: 0, y: -20, duration: 0.3, ease: "power2.in" },
      3.2
    );
    const dot = $(".dotch", $("#lineB"));
    tl.to(
      LB.filter((e) => e !== dot),
      { y: 70, opacity: 0, duration: 0.28, ease: "power2.in", stagger: 0.012 },
      3.2
    );
    tl.to(dot, { scale: 2.4, duration: 0.22, ease: "back.in(3)" }, 3.33);
    tl.set(dot, { opacity: 0 }, 3.55);

    // iris into S2
    show("#s2", 3.55, 8.3);
    const X = M.dot.x,
      Y = M.dot.y;
    tl.fromTo(
      "#s2",
      { clipPath: `circle(${M.dot.r * 2.4}px at ${X}px ${Y}px)` },
      {
        clipPath: `circle(${V ? 2700 : 2300}px at ${X}px ${Y}px)`,
        duration: 0.6,
        ease: "power3.inOut",
      },
      3.55
    );
    tl.set("#s2", { clipPath: "none" }, 4.2);
    const iris = document.createElement("div");
    iris.id = "irisRing";
    $("#s2").appendChild(iris);
    gsap.set(iris, {
      left: X,
      top: Y,
      xPercent: -50,
      yPercent: -50,
      width: M.dot.r * 4.8,
      height: M.dot.r * 4.8,
      borderWidth: 26,
      opacity: 1,
      visibility: "hidden",
    });
    tl.set(iris, { visibility: "visible" }, 3.55);
    tl.to(
      iris,
      {
        width: V ? 5400 : 4600,
        height: V ? 5400 : 4600,
        borderWidth: 70,
        duration: 0.6,
        ease: "power3.inOut",
      },
      3.55
    );
    tl.set(iris, { visibility: "hidden" }, 4.2);

    // ---------------- S2 goals → plan (4–8) ----------------
    const RY2 = V ? -10 : -16;
    gsap.set("#g2", { rotationY: RY2, rotationX: 4 });
    tl.fromTo(
      "#g2",
      { y: 120, rotationY: -38, scale: 0.9 },
      { y: 0, rotationY: RY2, scale: 1, duration: 1.2, ease: "expo.out" },
      3.6
    );
    tl.to(
      "#g2",
      {
        rotationY: V ? -4 : -8,
        rotationX: 2,
        duration: 3.4,
        ease: "sine.inOut",
      },
      4.6
    );
    fadeUp("#s2k", 4.1, 0.5, 16);
    rise(h2a, 4.15);
    // tap "Build muscle"
    tap($("#tap2"), M.opt.x, M.opt.y, 4.62);
    tl.to("#optSel .selbg", { opacity: 1, duration: 0.18 }, 4.62);
    tl.to(
      "#optSel .radio i",
      { scale: 1, duration: 0.35, ease: "back.out(3)" },
      4.62
    );
    tl.to(
      "#optSel .radio",
      { borderColor: "var(--p-primary)", duration: 0.1 },
      4.62
    );
    tap($("#tap2"), M.obBtn.x, M.obBtn.y, 5.0);
    tl.to(
      "#obBtn",
      { scale: 0.96, duration: 0.08, yoyo: true, repeat: 1 },
      5.0
    );
    // chips burst out of the phone
    const fcw = $$(".fcw");
    fcw.forEach((c, i) => {
      const [, , x, y] = CHIPS[i];
      tl.fromTo(
        c,
        { x: G2[0] - x, y: G2[1] - y, scale: 0.3, opacity: 0 },
        {
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          duration: 0.7,
          ease: "back.out(1.5)",
        },
        5.02 + i * 0.07
      );
      tl.to(
        c,
        {
          x: G2[0] - x,
          y: G2[1] - y,
          scale: 0.15,
          opacity: 0,
          duration: 0.42,
          ease: "power3.in",
        },
        5.85 + i * 0.04
      );
    });
    tl.to(
      "#p2a",
      { x: -60, opacity: 0, duration: 0.35, ease: "power2.in" },
      5.3
    );
    tl.fromTo(
      "#p2b",
      { x: 60, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.45, ease: "power3.out" },
      5.5
    );
    sink(h2a, 6.15);
    rise(h2b, 6.35);
    tl.to(
      "#p2b",
      { opacity: 0, scale: 0.96, duration: 0.16, ease: "power2.in" },
      6.6
    );
    tl.fromTo("#p2c", { opacity: 0 }, { opacity: 1, duration: 0.15 }, 6.76);
    tl.fromTo(
      "#p2c .qc",
      { y: 50, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: "expo.out", stagger: 0.09 },
      6.8
    );
    // whip pan out
    tl.to(
      ["#g2", "#s2copy"],
      { x: "-=1500", duration: 0.45, ease: "power3.in" },
      7.8
    );
    tl.to("#s2k", { opacity: 0, duration: 0.2 }, 7.8);

    // ---------------- S3 home + widgets (8–12) ----------------
    show("#s3", 7.95, 12.0);
    const RY3 = V ? 12 : 18;
    gsap.set("#g3", { rotationY: RY3, rotationX: 5 });
    tl.fromTo(
      "#g3",
      { x: 1500, rotationY: 40 },
      { x: 0, rotationY: RY3, duration: 0.8, ease: "expo.out" },
      8.0
    );
    tl.to(
      "#g3",
      { rotationY: V ? 4 : 6, rotationX: 2, duration: 3.2, ease: "sine.inOut" },
      8.6
    );
    tl.fromTo(
      "#s3copy",
      { x: 900 },
      { x: 0, duration: 0.8, ease: "expo.out" },
      8.05
    );
    fadeUp("#s3k", 8.2, 0.5, 16);
    rise(h3, 8.25);
    fadeUp("#s3sub", 8.9, 0.7);
    tl.fromTo(
      "#p3 .hs",
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: "expo.out", stagger: 0.05 },
      8.1
    );
    const W = V
      ? [
          ["#wNext", 60, 0.95],
          ["#wStreak", 90, 1.0],
          ["#wWeek", 50, 1.0],
          ["#wCons", 70, 0.95],
        ]
      : [
          ["#wNext", 90, 1.15],
          ["#wStreak", 140, 1.2],
          ["#wWeek", 70, 1.2],
          ["#wCons", 110, 1.15],
        ];
    W.forEach(([s, z, sc], i) => {
      tl.fromTo(
        s,
        { z: 0, scale: 0.5, opacity: 0, x: i % 2 ? -160 : 200, y: 60 },
        {
          z,
          scale: sc,
          opacity: 1,
          x: 0,
          y: 0,
          duration: 0.9,
          ease: "back.out(1.3)",
        },
        8.55 + i * 0.12
      );
    });
    tl.to(
      "#weekArc",
      { strokeDashoffset: 326.7 * (1 / 3), duration: 0.9, ease: "power3.out" },
      9.0
    );
    tl.fromTo(
      "#consGrid .cg",
      { scale: 0 },
      {
        scale: 1,
        duration: 0.4,
        ease: "back.out(2)",
        stagger: { each: 0.018, from: "start" },
      },
      9.1
    );
    tap($("#tap3"), M.nbtn3.x, M.nbtn3.y, 11.0);
    tl.to(
      "#nu3 .nbtn",
      { scale: 0.95, duration: 0.09, yoyo: true, repeat: 1 },
      11.0
    );
    tl.to(
      ["#wNext", "#wStreak", "#wWeek", "#wCons"],
      {
        opacity: 0,
        scale: 0.8,
        duration: 0.3,
        ease: "power2.in",
        stagger: 0.03,
      },
      11.2
    );
    tl.to(
      "#s3copy",
      { opacity: 0, x: 80, duration: 0.3, ease: "power2.in" },
      11.25
    );

    // ---------------- S4 workout (12–16) ----------------
    show("#s4", 11.8, 16.08);
    const RY4 = V ? 8 : 14;
    gsap.set("#g4", { rotationY: RY4, rotationX: 3 });
    tl.fromTo(
      "#g4",
      { scale: 1.15, rotationY: 0 },
      { scale: 1, rotationY: RY4, duration: 0.9, ease: "expo.out" },
      11.8
    );
    fadeUp("#s4k", 12.05, 0.5, 16);
    rise(h4, 12.1);
    const rows = [1, 2, 3].map((n) => $("#sr" + n));
    [12.5, 13.0, 13.5].forEach((t, i) => {
      const r = rows[i];
      tap($("#tap4"), M.chk[i].x, M.chk[i].y, t);
      tl.fromTo(
        $(".fill", r),
        { scale: 0 },
        { scale: 1, duration: 0.45, ease: "back.out(3)" },
        t
      );
      tl.fromTo(
        $(".ping", r),
        { scale: 1, opacity: 0.9 },
        {
          scale: 1.9,
          opacity: 0,
          duration: 0.42,
          ease: "power2.out",
          immediateRender: false,
        },
        t
      );
      tl.to($(".rowbg", r), { opacity: 1, duration: 0.2 }, t);
      tl.to($$(".num,.prev,.inp", r), { opacity: 0.7, duration: 0.3 }, t + 0.1);
      tl.to(
        "#wprog",
        { width: `${44 + i * 6}%`, duration: 0.4, ease: "power3.out" },
        t
      );
    });
    tl.fromTo(
      "#pillUp",
      { scale: 1 },
      {
        scale: 1.15,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        ease: "power2.out",
      },
      12.5
    );
    tl.fromTo(
      "#restbar",
      { y: 150 },
      { y: 0, duration: 0.6, ease: "expo.out" },
      13.7
    );
    tl.to(
      "#isl4",
      { width: 210, marginLeft: -105, duration: 0.5, ease: "back.out(1.6)" },
      13.8
    );
    tl.to("#isl4 .isl", { opacity: 1, duration: 0.25 }, 13.95);
    // pull back to the ecosystem shot
    tl.to(
      "#s4copy",
      { opacity: 0, x: 120, duration: 0.35, ease: "power2.in" },
      13.85
    );
    tl.to(
      "#g4",
      {
        x: V ? -175 : 260,
        y: V ? -160 : -20,
        scale: V ? 0.78 : 0.8,
        rotationY: 0,
        rotationX: 0,
        duration: 0.8,
        ease: "power3.inOut",
      },
      14.0
    );
    gsap.set(
      "#watch",
      V
        ? { scale: 1.15, left: 780, top: 1335 }
        : { scale: 1.55, left: 390, top: 520 }
    );
    tl.fromTo(
      "#watch",
      { x: V ? 700 : -700, rotationY: 50, opacity: 0 },
      { x: 0, rotationY: 0, opacity: 1, duration: 0.9, ease: "expo.out" },
      14.2
    );
    gsap.set(
      "#ph4b",
      V
        ? { scale: 0.62, left: 780, top: 850 }
        : { scale: 0.84, left: 1530, top: 520 }
    );
    tl.fromTo(
      "#ph4b",
      { x: 700, rotationY: -50, opacity: 0 },
      { x: 0, rotationY: 0, opacity: 1, duration: 0.9, ease: "expo.out" },
      14.3
    );
    tl.fromTo(
      "#live",
      { y: 60, opacity: 0, scale: 0.9 },
      { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: "expo.out" },
      14.7
    );
    fadeUp("#s4cap", 14.6, 0.6);
    // zoom through the phone into the last set
    tl.to(
      "#g4",
      { scale: 3.6, y: 400, duration: 0.5, ease: "power3.in" },
      15.55
    );
    tl.to(
      "#watch",
      { x: V ? 800 : -800, opacity: 0, duration: 0.45, ease: "power3.in" },
      15.5
    );
    tl.to(
      "#ph4b",
      { x: 800, opacity: 0, duration: 0.45, ease: "power3.in" },
      15.5
    );
    tl.to("#s4cap", { opacity: 0, duration: 0.25 }, 15.5);
    tl.to("#s4", { opacity: 0, duration: 0.18 }, 15.88);

    // ---------------- S5 last set (16–18) ----------------
    show("#s5", 15.85, 18.0);
    tl.fromTo("#s5", { opacity: 0 }, { opacity: 1, duration: 0.2 }, 15.85);
    tl.fromTo(
      "#bigNum",
      { scale: 1.3, filter: "blur(20px)" },
      { scale: 1, filter: "blur(0px)", duration: 0.6, ease: "expo.out" },
      15.9
    );
    fadeUp("#s5k", 16.0, 0.5, 16);
    tl.fromTo(
      ".rep",
      { scale: 0, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: 0.5,
        ease: "back.out(2)",
        stagger: 0.04,
      },
      15.95
    );
    fadeUp("#s5sub", 16.2, 0.5, 20);
    const REPS = [16.0, 16.5, 17.0, 17.375, 17.75];
    const reps = $$(".rep");
    REPS.forEach((t, i) => {
      tl.to($(".repFill", reps[i]), { opacity: 1, duration: 0.12 }, t);
      tl.to($(".repN", reps[i]), { color: "#4A3200", duration: 0.1 }, t);
      tl.fromTo(
        reps[i],
        { scale: 1.35 },
        { scale: 1, duration: 0.4, ease: "back.out(3)" },
        t
      );
      tl.to(
        "#bigFill",
        {
          clipPath: `inset(${100 - (i + 1) * 20}% 0 0 0)`,
          duration: 0.35,
          ease: "expo.out",
        },
        t
      );
      tl.fromTo(
        "#bigNum",
        { scale: 1 + 0.03 * (i + 1) },
        { scale: 1 + 0.01 * i, duration: 0.35, ease: "power3.out" },
        t
      );
    });
    tl.to("#bigNum", { scale: 0.94, duration: 0.24, ease: "power2.in" }, 17.76);

    // ---------------- S6 PR (18–22) ----------------
    show("#s6", 18.0, 22.2);
    tl.set("#flash", { opacity: 0.95 }, 18.0);
    tl.to("#flash", { opacity: 0, duration: 0.35, ease: "power2.out" }, 18.0);
    $$(".shock").forEach((s, i) =>
      tl.fromTo(
        s,
        { scale: 0.3, opacity: 1, borderWidth: 14 },
        {
          scale: 9 + i * 2,
          opacity: 0,
          borderWidth: 2,
          duration: 1.1 + i * 0.2,
          ease: "expo.out",
        },
        18.0 + i * 0.07
      )
    );
    gsap.set("#prBadge", { xPercent: -50, yPercent: -50, left: 0, top: 0 });
    const bw = $("#prBadge").offsetWidth;
    tl.fromTo(
      "#prBadge",
      { scale: 0.3, y: 30, opacity: 0 },
      {
        scale: V ? 1.8 : 2.1,
        y: 0,
        opacity: 1,
        duration: 1.0,
        ease: "elastic.out(1, 0.55)",
      },
      18.02
    );
    rise(h6, 18.3, 0.8);
    tl.to(
      "#prWrap",
      V
        ? { x: 0, y: -390, duration: 0.8, ease: "expo.inOut" }
        : {
            x: 150 + (bw * 1.6) / 2 - 960,
            y: 10,
            duration: 0.8,
            ease: "expo.inOut",
          },
      19.5
    );
    tl.to(
      "#prBadge",
      { scale: V ? 1.3 : 1.6, duration: 0.8, ease: "expo.inOut" },
      19.5
    );
    sink(h6, 19.45, 0.35);
    rise(h6bl, 19.85);
    gsap.set(
      "#story",
      V
        ? { xPercent: -50, yPercent: -50, left: 540, top: 1085, scale: 1.25 }
        : { xPercent: -50, yPercent: -50, left: 1370, top: 540, scale: 1.26 }
    );
    tl.fromTo(
      "#story",
      { x: 900, rotationY: -40, opacity: 0 },
      {
        x: 0,
        rotationY: V ? -6 : -10,
        opacity: 1,
        duration: 1.0,
        ease: "expo.out",
      },
      19.6
    );
    tl.to("#story", { rotationY: -4, duration: 1.6, ease: "sine.inOut" }, 20.6);
    tl.fromTo(
      ".hlr",
      { x: 30, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.5, ease: "expo.out", stagger: 0.08 },
      20.1
    );
    tl.to(
      ["#prWrap", h6b, "#story"],
      {
        scale: "-=0.15",
        opacity: 0,
        filter: "blur(12px)",
        duration: 0.38,
        ease: "power3.in",
        stagger: 0.03,
      },
      21.75
    );

    // ---------------- S7 progress (22–26) ----------------
    show("#s7", 21.95, 26.3);
    gsap.set(
      "#g7",
      V
        ? { rotationY: -8, rotationX: 6, scale: 0.9 }
        : { rotationY: -14, rotationX: 7 }
    );
    tl.to(
      "#g7",
      { rotationY: V ? -2 : -5, rotationX: 3, duration: 4, ease: "sine.inOut" },
      22.0
    );
    tl.fromTo(
      "#g7 .bcard",
      { z: 500, opacity: 0, y: 60 },
      {
        z: 0,
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "expo.out",
        stagger: 0.07,
      },
      21.95
    );
    fadeUp("#s7k", 22.15, 0.5, 16);
    rise(h7, 22.2);
    tl.to(
      "#lp",
      { strokeDashoffset: 0, duration: 1.3, ease: "power2.inOut" },
      22.45
    );
    tl.to(
      "#lcr",
      { attr: { width: CW }, duration: 1.3, ease: "power2.inOut" },
      22.45
    );
    tl.fromTo(
      "#bars .bar",
      { scaleY: 0 },
      { scaleY: 1, duration: 0.7, ease: "expo.out", stagger: 0.045 },
      22.5
    );
    tl.fromTo(
      "#tip",
      { opacity: 0, scale: 0.8 },
      { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" },
      23.6
    );
    tl.to("#xh", { attr: { opacity: 1 }, duration: 0.25 }, 23.55);
    // collapse into the logo
    tl.to(
      "#g7 .bcard",
      {
        x: (i) => [260, -160, 260, -160][i],
        y: (i) => [200, 200, -120, -120][i],
        scale: 0.1,
        opacity: 0,
        rotation: (i) => [-20, 20, 20, -20][i],
        duration: 0.42,
        ease: "power3.in",
        stagger: 0.03,
      },
      25.6
    );
    tl.to(
      "#g7",
      V
        ? { y: -430, duration: 0.45, ease: "power3.in" }
        : { x: -330, duration: 0.45, ease: "power3.in" },
      25.6
    );
    tl.to(
      "#s7copy",
      { opacity: 0, x: -60, duration: 0.3, ease: "power2.in" },
      25.6
    );

    // ---------------- S8 end card (26–30) ----------------
    show("#s8", 25.98);
    gsap.set("#logo", { scale: LOGO_S, y: LOGO_Y });
    [0, 1, 2, 3].forEach((i) =>
      tl.fromTo(
        "#lr" + i,
        { scale: 0 },
        { scale: 1, duration: 0.8, ease: "elastic.out(1.1, 0.5)" },
        26.0 + i * 0.09
      )
    );
    tl.fromTo(
      "#lh",
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: "back.out(2)" },
      26.38
    );
    $$(".er").forEach((e, i) =>
      tl.fromTo(
        e,
        { scale: 0.5, opacity: 0.55 },
        { scale: 5 + i, opacity: 0, duration: 2.2, ease: "expo.out" },
        26.0 + i * 0.12
      )
    );
    tl.fromTo(
      "#wm",
      { yPercent: 110 },
      { yPercent: 0, duration: 0.9, ease: "expo.out" },
      26.7
    );
    if (K) {
      $("#tagline").innerHTML = [
        "PLAN.",
        "TRAIN.",
        '<span style="color:var(--acc)">PROGRESS.</span>',
      ]
        .map(
          (w) => `<span class="mask"><span class="mi tgw">${w}</span></span>`
        )
        .join(" ");
      $("#tagline").className = "disp";
      $("#tagline").style.cssText +=
        `;font-size:78px;top:${V ? 1215 : 800}px;word-spacing:.12em`;
      tl.fromTo(
        ".tgw",
        { yPercent: 150, scale: 1.25 },
        {
          yPercent: 0,
          scale: 1,
          duration: 0.5,
          ease: "expo.out",
          stagger: 0.25,
        },
        27.05
      );
    } else
      tl.fromTo(
        "#tg",
        { yPercent: 110 },
        { yPercent: 0, duration: 0.8, ease: "expo.out" },
        27.15
      );
    gsap.set("#cta", { xPercent: -50 });
    if (K || V) gsap.set("#cta", { top: V ? 1345 : 935 });
    tl.fromTo(
      "#cta",
      { scale: 0.7, opacity: 0, y: 20 },
      { scale: 1, opacity: 1, y: 0, duration: 0.7, ease: "back.out(2)" },
      27.95
    );
    tl.set({}, {}, 30);
  }

  // ======================================================================
  // procedural layer
  // ======================================================================
  let lastGrain = -1;
  function procedural(t, f) {
    // grain
    if (f !== lastGrain) {
      lastGrain = f;
      gc.style.transform = `translate(${Math.floor(hash(f) * 64)}px, ${Math.floor(hash(f + 0.37) * 60)}px)`;
    }

    // camera shake (build-up + impacts)
    let sh = 0;
    if (t > 16.4 && t < 18) sh += 5 * P(t, 16.4, 17.9, (x) => x * x);
    if (t >= 18 && t < 18.7) sh += 22 * Math.exp(-(t - 18) * 7);
    if (t >= 26 && t < 26.5) sh += 8 * Math.exp(-(t - 26) * 9);
    if (sh > 0.01)
      cam.style.transform = `translate(${(hash(t * 91.3) - 0.5) * 2 * sh}px, ${(hash(t * 57.9 + 3) - 0.5) * 2 * sh}px)`;
    else cam.style.transform = "";

    // kinetic: outline words drift in alternating directions
    if (K)
      $$(".bgword").forEach((w) => {
        const d = Number(w.dataset.dir);
        w.style.transform = `translateX(${d < 0 ? -200 - t * 110 : -1800 + t * 110}px)`;
      });

    // bg ring pulse on beats
    const beat = t >= 2 ? Math.exp(-((t - 2) % 0.5) * 7) : 0;
    $("#bgRings").style.transform =
      `translate(-50%,-50%) scale(${1 + beat * 0.012 + t * 0.004})`;

    // S1 dim → iris ring
    // S2 loader + skeleton pulse
    if (t > 5.3 && t < 7) {
      const lo = $("#loader");
      if (!lo.childElementCount)
        lo.innerHTML = SIZES.map(
          (s, i) =>
            `<i style="width:${s * 0.7}px;height:${s * 0.7}px;margin:${-s * 0.35}px 0 0 ${-s * 0.35}px;background:${PAL[i]}"></i>`
        ).join("");
      $$("#loader i").forEach((e, i) => {
        const k = Math.sin((t - 5.3) * 7 - i * 0.9);
        e.style.transform = `scale(${1 + 0.1 * k})`;
      });
      $$("#p2b .sk").forEach(
        (e, i) =>
          (e.style.opacity = 0.55 + 0.45 * Math.sin((t - 5.3) * 7.85 - i * 0.5))
      );
      $$(".fchip").forEach(
        (c, i) =>
          (c.style.transform = `translate(-50%,-50%) translateY(${Math.sin(t * 3 + i * 1.7) * 8}px)`)
      );
    }

    // S4 clocks
    if (t > 11.5 && t < 16.2) {
      $("#wtimer").textContent =
        `24:${String(13 + Math.floor(t - 11.5)).padStart(2, "0")}`;
      const done = t >= 13.5 ? 10 : t >= 13.0 ? 9 : t >= 12.5 ? 8 : 7;
      $("#setsDone").textContent = `${done}/18 sets`;
      const rest = 90 - Math.max(0, t - 13.7) * 3;
      const s = fmtT(rest);
      $("#rbTime").textContent = s;
      $("#islR").textContent = s;
      $("#watchTime").textContent = s;
      $("#lvTime").textContent = s;
      $("#rbTrack").style.transform = `scaleX(${rest / 90})`;
      $("#watchArc").style.strokeDashoffset = 389.6 * (1 - rest / 120);
      $("#hr").textContent = Math.round(
        141 - (t - 12) * 2 + Math.sin(t * 2) * 1.5
      );
      $("#lvElapsed").textContent =
        `24:${String(40 + Math.floor(t - 14)).padStart(2, "0")}`;
    }

    // S6 confetti + counter
    if (t >= 18 && t < 22.2) {
      for (const c of CONF) {
        const tt = t - 18 - c.delay;
        if (tt < 0) {
          c.el.style.opacity = 0;
          continue;
        }
        let x, y;
        if (c.burst) {
          const k = 2.4,
            e = (1 - Math.exp(-k * tt)) / k;
          x = c.x0 + c.vx * e + Math.sin(tt * 3 + c.sway) * 20 * tt;
          y = c.y0 + c.vy * e + 0.5 * 900 * tt * tt;
        } else {
          x = c.x0 + c.vx * tt + Math.sin(tt * 2.4 + c.sway) * 60;
          y = c.y0 + c.vy * tt + 0.5 * 240 * tt * tt;
        }
        const op = clamp01(1.2 - Math.max(0, tt - 2.2) * 0.8);
        c.el.style.opacity = op;
        c.el.style.transform = `translate(${x}px, ${y}px) rotate(${c.rot + c.spin * tt}deg) scaleY(${Math.cos(tt * c.flip + c.sway)})`;
      }
      const v = Math.round((12450 * P(t, 19.9, 21.0, ease.o3)) / 5) * 5;
      $("#vol").textContent = v.toLocaleString("en-US");
    }

    // S7 heatmap, crosshair, streak
    if (t > 21.9 && t < 26.4) {
      for (const h of HM) {
        const at = 22.45 + h.c * 0.042 + h.r * 0.012;
        const p = P(t, at, at + 0.3);
        const target = [0.1, 0.25, 0.5, 0.75, 1][h.lvl];
        h.e.style.opacity = 0.1 + (target - 0.1) * p;
        h.e.style.transform = `scale(${h.lvl ? 0.4 + 0.6 * ease.o5(p) + (p > 0 && p < 1 ? 0.15 * Math.sin(p * Math.PI) : 0) : 1})`;
      }
      const u = P(t, 23.6, 25.2, ease.io3);
      const xi = lerp(pts[7][0], pts[11][0], u);
      const yy = yAtX(xi);
      $("#xhl").setAttribute("x1", xi);
      $("#xhl").setAttribute("x2", xi);
      $("#xhh").setAttribute("cx", xi);
      $("#xhh").setAttribute("cy", yy);
      $("#xhd").setAttribute("cx", xi);
      $("#xhd").setAttribute("cy", yy);
      const idx = Math.round(lerp(7, 11, u));
      const isPR = idx === 11 && u > 0.97;
      $("#tipV").innerHTML =
        `${DATA[idx]} kg${isPR ? ' <span style="color:var(--p-gold)">· New PR</span>' : ""}`;
      $("#tipD").textContent = DATES[idx];
      const tip = $("#tip");
      tip.style.left = `${30 + xi - tip.offsetWidth / 2 - (isPR ? 40 : 0)}px`;
      tip.style.top = `${112 + yy - 78}px`;
      if (isPR) $("#xhd").setAttribute("fill", LIGHT ? "#E3A50B" : "#FFC53D");
      else $("#xhd").setAttribute("fill", primary);
      $("#streakN").textContent = Math.round(5 * P(t, 22.5, 23.4));
    }

    // S8 breathe
    if (t > 25.9) {
      const b =
        t > 27.2 ? 1 + 0.02 * Math.sin((t - 27.2) * ((Math.PI * 2) / 1.6)) : 1;
      $("#logo").style.transform =
        `translate(0px, ${LOGO_Y}px) scale(${LOGO_S * b})`;
    }
  }

  // ======================================================================
  let ready = false;
  function buildWipe() {
    tl.seek(11.22, true);
    procedural(11.22, 0);
    const br = $("#nu3 .nbtn").getBoundingClientRect();
    tl.set("#wipe", { visibility: "visible" }, 11.25);
    tl.fromTo(
      "#wipe",
      {
        left: br.left,
        top: br.top,
        width: br.width,
        height: br.height,
        borderRadius: 14,
        opacity: 1,
      },
      {
        left: -20,
        top: -20,
        width: SW + 40,
        height: SH + 40,
        borderRadius: 0,
        duration: 0.45,
        ease: "expo.inOut",
      },
      11.25
    );
    tl.to(
      "#wipe",
      { y: -(SH + 100), duration: 0.42, ease: "expo.inOut" },
      11.7
    );
    tl.set("#wipe", { visibility: "hidden" }, 12.25);
  }
  // wait for fonts and every background image to decode, so no frame shows a half-loaded thumbnail
  const imagesReady = () =>
    Promise.all(
      $$('[style*="background-image"]').map((el) => {
        const m = /url\(["']?([^"')]+)["']?\)/.exec(el.style.backgroundImage);
        if (!m) return null;
        const img = new Image();
        img.src = m[1];
        return img
          .decode()
          .catch(() => console.error("image failed to load: " + m[1]));
      })
    );
  Promise.all([document.fonts.ready, imagesReady()]).then(() => {
    portraitLayout();
    measure();
    if (V) gsap.set(["#ph2", "#ph3", "#ph4"], { scale: 1.0 });
    build();
    buildWipe();
    tl.seek(0);
    window.__tl = tl;
    ready = true;
    window.__ready = true;
  });
  window.renderAt = (t, f = Math.round(t * 60)) => {
    if (!ready) return;
    tl.seek(t, true);
    procedural(t, f);
  };
  // live preview when opened in a browser: ?play=1&t=12
  if (Q.get("play")) {
    const t0 = performance.now() - Number(Q.get("t") || 0) * 1000;
    const loop = () => {
      const t = ((performance.now() - t0) / 1000) % 30;
      window.renderAt(t, Math.floor(t * 60));
      requestAnimationFrame(loop);
    };
    document.fonts.ready.then(() => setTimeout(loop, 100));
  } else if (Q.get("t")) {
    const once = () =>
      window.__ready
        ? window.renderAt(Number(Q.get("t")))
        : setTimeout(once, 50);
    once();
  }
})();
