import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const conceptFiles = [
  "sol-concepts.html",
  "terra-concepts.html",
  "fable-concepts.html",
  "opus-concepts.html",
  "grok-concepts.html",
  "kimi-concepts.html",
];

const fragments = await Promise.all(
  conceptFiles.map(async (file) => {
    const source = await readFile(join(root, "concepts", file), "utf8");
    const articles = source.match(/<article class="concept"[\s\S]*?<\/article>/g);

    if (!articles?.length) {
      throw new Error(`No concept articles found in ${file}`);
    }

    return articles.join("\n");
  }),
);

const document = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta
      name="description"
      content="Twenty app icon explorations for Sweaty, an intelligent workout app."
    />
    <title>Sweaty — App Icon Explorations</title>
    <style>
      @import url("https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&display=swap");

      :root {
        color-scheme: dark;
        --ink: #f2f4f7;
        --muted: #8b929a;
        --line: rgba(255, 255, 255, 0.1);
        --line-bright: rgba(255, 255, 255, 0.2);
        --paper: #0b0d0f;
        --panel: #121416;
        --blue: #3898d8;
        --violet: #5e6ee0;
        --mono: "DM Mono", ui-monospace, monospace;
        --sans: "Manrope", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
      }

      body {
        margin: 0;
        min-width: 320px;
        color: var(--ink);
        background:
          radial-gradient(circle at 82% -5%, rgba(56, 152, 216, 0.15), transparent 28rem),
          radial-gradient(circle at 12% 20%, rgba(94, 110, 224, 0.08), transparent 24rem),
          var(--paper);
        font-family: var(--sans);
      }

      button {
        font: inherit;
      }

      .page {
        width: min(1600px, 100%);
        margin: 0 auto;
        padding: 0 32px 64px;
      }

      .masthead {
        min-height: 70vh;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(280px, 0.43fr);
        gap: 8vw;
        align-items: end;
        padding: 54px 0 64px;
        border-bottom: 1px solid var(--line);
      }

      .eyebrow,
      .meta,
      .source,
      .number,
      .filter-label {
        font-family: var(--mono);
        font-size: 11px;
        letter-spacing: 0.09em;
        text-transform: uppercase;
      }

      .eyebrow {
        display: flex;
        align-items: center;
        gap: 12px;
        color: #b8bdc5;
        margin: 0 0 28px;
      }

      .eyebrow::before {
        width: 30px;
        height: 2px;
        content: "";
        background: linear-gradient(90deg, var(--blue), var(--violet));
      }

      h1 {
        max-width: 900px;
        margin: 0;
        font-size: clamp(64px, 10vw, 160px);
        font-weight: 600;
        line-height: 0.84;
        letter-spacing: -0.075em;
      }

      h1 span {
        color: transparent;
        -webkit-text-stroke: 1px rgba(255, 255, 255, 0.36);
      }

      .intro {
        align-self: end;
        padding-bottom: 8px;
      }

      .intro p {
        max-width: 440px;
        margin: 0 0 34px;
        color: #aeb4bc;
        font-size: clamp(16px, 1.4vw, 21px);
        line-height: 1.55;
      }

      .stats {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        border-top: 1px solid var(--line);
        border-bottom: 1px solid var(--line);
      }

      .stat {
        padding: 18px 0;
      }

      .stat + .stat {
        padding-left: 24px;
        border-left: 1px solid var(--line);
      }

      .stat strong {
        display: block;
        margin-bottom: 4px;
        font-size: 22px;
        font-weight: 600;
      }

      .stat span {
        color: var(--muted);
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .controls {
        position: sticky;
        z-index: 20;
        top: 0;
        display: flex;
        gap: 24px;
        align-items: center;
        justify-content: space-between;
        padding: 18px 0;
        background: rgba(11, 13, 15, 0.9);
        border-bottom: 1px solid var(--line);
        backdrop-filter: blur(18px);
      }

      .filter-wrap {
        display: flex;
        gap: 14px;
        align-items: center;
        min-width: 0;
      }

      .filter-label {
        flex: none;
        color: var(--muted);
      }

      .filters {
        display: flex;
        gap: 7px;
        overflow-x: auto;
        scrollbar-width: none;
      }

      .filters::-webkit-scrollbar {
        display: none;
      }

      .chip,
      .mask-toggle,
      .action {
        color: #b7bdc4;
        background: transparent;
        border: 1px solid var(--line);
        cursor: pointer;
        transition: 180ms ease;
      }

      .chip {
        flex: none;
        padding: 9px 12px;
        border-radius: 999px;
        font-family: var(--mono);
        font-size: 10px;
        letter-spacing: 0.03em;
      }

      .chip:hover,
      .chip.active,
      .mask-toggle:hover,
      .action:hover {
        color: #fff;
        border-color: var(--line-bright);
        background: rgba(255, 255, 255, 0.06);
      }

      .chip.active {
        border-color: rgba(56, 152, 216, 0.5);
        box-shadow: inset 0 0 0 1px rgba(56, 152, 216, 0.14);
      }

      .mask-toggle {
        flex: none;
        padding: 9px 12px;
        border-radius: 8px;
        font-family: var(--mono);
        font-size: 10px;
      }

      .gallery {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        border-left: 1px solid var(--line);
      }

      .concept {
        position: relative;
        min-width: 0;
        padding: 18px;
        border-right: 1px solid var(--line);
        border-bottom: 1px solid var(--line);
        transition: background 220ms ease;
      }

      .concept:hover {
        background: rgba(255, 255, 255, 0.025);
      }

      .concept[hidden] {
        display: none;
      }

      .concept > svg {
        display: block;
        width: 100%;
        height: auto;
        background: #121416;
        border-radius: 25.5%;
        box-shadow:
          0 18px 60px rgba(0, 0, 0, 0.32),
          inset 0 0 0 1px rgba(255, 255, 255, 0.04);
        transition:
          border-radius 250ms ease,
          transform 250ms ease,
          box-shadow 250ms ease;
      }

      .concept:hover > svg {
        transform: translateY(-3px);
        box-shadow:
          0 26px 70px rgba(0, 0, 0, 0.42),
          inset 0 0 0 1px rgba(255, 255, 255, 0.07);
      }

      .gallery.square .concept > svg {
        border-radius: 0;
      }

      .card-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-height: 45px;
        color: var(--muted);
      }

      .number {
        color: #d5d9de;
      }

      .source {
        max-width: 72%;
        overflow: hidden;
        color: #777e87;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .concept h2 {
        margin: 22px 0 8px;
        font-size: 19px;
        font-weight: 600;
        letter-spacing: -0.03em;
      }

      .concept > p {
        min-height: 64px;
        margin: 0;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.55;
      }

      .card-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-top: 20px;
        padding-top: 14px;
        border-top: 1px solid var(--line);
      }

      .sizes {
        display: flex;
        gap: 10px;
        align-items: end;
      }

      .sizes svg {
        display: block;
        overflow: hidden;
        border-radius: 23%;
      }

      .sizes svg:first-child {
        width: 32px;
        height: 32px;
      }

      .sizes svg:last-child {
        width: 18px;
        height: 18px;
      }

      .action {
        padding: 8px 10px;
        border-radius: 7px;
        font-family: var(--mono);
        font-size: 9px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .concept.is-shortlisted::after {
        position: absolute;
        top: 72px;
        right: 28px;
        width: 9px;
        height: 9px;
        content: "";
        background: #fff;
        border-radius: 50%;
        box-shadow: 0 0 0 5px rgba(56, 152, 216, 0.24);
      }

      .footer {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 30px;
        padding: 64px 0 18px;
      }

      .footer strong {
        font-size: clamp(28px, 4vw, 58px);
        font-weight: 500;
        letter-spacing: -0.055em;
      }

      .footer p {
        max-width: 390px;
        margin: 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.6;
      }

      @media (max-width: 1100px) {
        .gallery {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      @media (max-width: 800px) {
        .page {
          padding-inline: 18px;
        }

        .masthead {
          min-height: auto;
          grid-template-columns: 1fr;
          gap: 52px;
          padding-top: 80px;
        }

        .controls {
          align-items: flex-start;
        }

        .filter-wrap {
          align-items: flex-start;
          flex-direction: column;
          gap: 8px;
        }

        .gallery {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 520px) {
        .page {
          padding-inline: 12px;
        }

        .controls {
          align-items: stretch;
          flex-direction: column;
          gap: 12px;
        }

        .filter-wrap,
        .filters {
          width: 100%;
        }

        .mask-toggle {
          align-self: flex-start;
        }

        h1 {
          font-size: 28vw;
        }

        .gallery {
          grid-template-columns: 1fr;
        }

        .concept > p {
          min-height: auto;
        }

        .footer {
          align-items: flex-start;
          flex-direction: column;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          scroll-behavior: auto !important;
          transition: none !important;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <header class="masthead">
        <div>
          <p class="eyebrow">App icon study / 01</p>
          <h1>Sweaty<span>.</span></h1>
        </div>
        <div class="intro">
          <p>
            Twenty ways to express quiet intensity: training direction,
            continuity, and progress—without the usual fitness clichés.
          </p>
          <div class="stats" aria-label="Study overview">
            <div class="stat"><strong>20</strong><span>Vector marks</span></div>
            <div class="stat"><strong>6</strong><span>Independent passes</span></div>
          </div>
        </div>
      </header>

      <nav class="controls" aria-label="Gallery controls">
        <div class="filter-wrap">
          <span class="filter-label">Filter</span>
          <div class="filters" role="group" aria-label="Filter concepts by source">
            <button class="chip active" type="button" data-filter="all">All 20</button>
          </div>
        </div>
        <button class="mask-toggle" type="button" aria-pressed="false">
          Square preview
        </button>
      </nav>

      <section class="gallery" aria-label="Sweaty app icon concepts">
        ${fragments.join("\n")}
      </section>

      <footer class="footer">
        <strong>Pick the one<br />you remember.</strong>
        <p>
          Shortlist promising directions, inspect them at true icon sizes, and
          download any source SVG. The strongest mark should work before its
          story is explained.
        </p>
      </footer>
    </main>

    <script>
      const gallery = document.querySelector(".gallery");
      const concepts = [...document.querySelectorAll(".concept")];
      const filterBar = document.querySelector(".filters");
      const maskToggle = document.querySelector(".mask-toggle");
      const sources = [...new Set(concepts.map((item) => item.dataset.source))];

      const slugify = (value) =>
        value
          .toLowerCase()
          .normalize("NFKD")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

      sources.forEach((source) => {
        const button = document.createElement("button");
        button.className = "chip";
        button.type = "button";
        button.dataset.filter = source;
        button.textContent = source.replace("Cursor · ", "");
        filterBar.append(button);
      });

      concepts.forEach((concept, index) => {
        const svg = concept.querySelector(":scope > svg");
        const name = concept.querySelector("h2").textContent.trim();
        const top = document.createElement("div");
        const foot = document.createElement("div");
        const sizes = document.createElement("div");
        const download = document.createElement("button");
        const shortlist = document.createElement("button");

        top.className = "card-top";
        top.innerHTML =
          '<span class="number">' +
          String(index + 1).padStart(2, "0") +
          '</span><span class="source">' +
          concept.dataset.source +
          "</span>";
        concept.prepend(top);

        sizes.className = "sizes";
        sizes.setAttribute("aria-label", "32 and 18 pixel previews");
        sizes.append(svg.cloneNode(true), svg.cloneNode(true));

        download.className = "action";
        download.type = "button";
        download.textContent = "SVG";
        download.setAttribute("aria-label", "Download " + name + " as SVG");
        download.addEventListener("click", () => {
          const clone = svg.cloneNode(true);
          clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
          const blob = new Blob([clone.outerHTML], { type: "image/svg+xml" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = "sweaty-" + slugify(name) + ".svg";
          link.click();
          URL.revokeObjectURL(link.href);
        });

        shortlist.className = "action";
        shortlist.type = "button";
        shortlist.textContent = "Shortlist";
        shortlist.setAttribute("aria-pressed", "false");
        shortlist.addEventListener("click", () => {
          const selected = concept.classList.toggle("is-shortlisted");
          shortlist.setAttribute("aria-pressed", String(selected));
          shortlist.textContent = selected ? "Selected" : "Shortlist";
        });

        foot.className = "card-foot";
        foot.append(sizes, shortlist, download);
        concept.append(foot);
      });

      filterBar.addEventListener("click", (event) => {
        const button = event.target.closest("[data-filter]");
        if (!button) return;
        document.querySelectorAll(".chip").forEach((chip) => {
          chip.classList.toggle("active", chip === button);
        });
        concepts.forEach((concept) => {
          concept.hidden =
            button.dataset.filter !== "all" &&
            concept.dataset.source !== button.dataset.filter;
        });
      });

      maskToggle.addEventListener("click", () => {
        const square = gallery.classList.toggle("square");
        maskToggle.setAttribute("aria-pressed", String(square));
        maskToggle.textContent = square ? "App mask preview" : "Square preview";
      });
    </script>
  </body>
</html>
`;

await writeFile(join(root, "index.html"), document);
