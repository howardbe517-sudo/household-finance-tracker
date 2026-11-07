#!/usr/bin/env node
// Builds a step-by-step handoff page (HTML) from a JSON spec, with the full
// text of every file to paste embedded behind a "Copy" button, the expected
// last line number for each file, and checkboxes the owner can tick off.
//
//   node scripts/build-handoff.js <spec.json> <out.html>
//
// The page is published with the Artifact tool. Spec shape (see
// evaluation-tracker/handoffs/ for real examples):
// {
//   "title": "Eval Tracker Update Steps",          // page name, 2-4 words
//   "subtitle": "What this update is, in one line.",
//   "intro": ["Paragraph.", "Paragraph."],          // plain text, **bold**, `code`, {{Key}}
//   "sections": [
//     { "heading": "In the Apps Script editor",
//       "steps": [
//         { "text": "Click **+** next to Files, choose **Script**, name it `Settings`.",
//           "file": "evaluation-tracker/Settings.gs",   // optional: adds Copy + Show code
//           "note": "Save with {{Ctrl}}+{{S}}." }        // optional second line
//       ] }
//   ]
// }
// Inline marks in text: **bold**, `code`, {{Key}} for a keyboard key.

const fs = require("fs");
const path = require("path");

const [specPath, outPath] = process.argv.slice(2);
if (!specPath || !outPath) {
  console.error("Usage: node scripts/build-handoff.js <spec.json> <out.html>");
  process.exit(1);
}

const ROOT = path.join(__dirname, "..");
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// **bold**, `code`, {{Key}}, [link text](https://...)
function marks(text) {
  return esc(text)
    .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\{\{([^}]+)\}\}/g, "<kbd>$1</kbd>");
}

const files = [];
let stepNumber = 0;
const sectionsHtml = spec.sections.map((section) => {
  const steps = section.steps.map((step) => {
    stepNumber++;
    const id = "s" + stepNumber;
    let fileHtml = "";
    if (step.file) {
      const abs = path.join(ROOT, step.file);
      const text = fs.readFileSync(abs, "utf8");
      const lastLine = text.replace(/\n+$/, "").split("\n").length;
      const index = files.length;
      files.push({ name: path.basename(step.file), text });
      fileHtml =
        `<p class="lines">Save with <kbd>Ctrl</kbd>+<kbd>S</kbd>. The last line number should be <strong>${lastLine}</strong>. If it stops early, select all and paste again.</p>` +
        `<div class="file-actions">` +
        `<button class="copy" type="button" data-file="${index}">Copy ${esc(path.basename(step.file))} (${lastLine} lines)</button>` +
        `<button class="show" type="button" data-file="${index}" aria-expanded="false">Show code</button>` +
        `</div>` +
        `<pre class="code" data-file="${index}" hidden tabindex="0"></pre>`;
    }
    const note = step.note ? `<p class="note">${marks(step.note)}</p>` : "";
    return (
      `<li class="step" id="${id}">` +
      `<label class="tick"><input type="checkbox" data-step="${id}"><span class="box" aria-hidden="true"></span><span class="sr">Done</span></label>` +
      `<div class="body">` +
      `<p class="text"><span class="num">${stepNumber}.</span> ${marks(step.text)}</p>` +
      note +
      fileHtml +
      `</div></li>`
    );
  });
  return `<section class="group"><h2>${marks(section.heading)}</h2><ol class="steps">${steps.join("")}</ol></section>`;
});

const intro = (spec.intro || []).map((p) => `<p>${marks(p)}</p>`).join("");
// The checkmarks are saved per page and per version of the files on it: when
// a file to paste changes, the page starts with every box empty again.
const fileStamp = require("crypto").createHash("sha1")
  .update(JSON.stringify(files.map((f) => f.text)) + JSON.stringify(spec.sections)).digest("hex").slice(0, 10);
const pageKey = "handoff:" + (spec.key || spec.title).replace(/\W+/g, "-").toLowerCase() + ":" + fileStamp;
const filesJson = JSON.stringify(files).replace(/</g, "\\u003c");

const html = `<title>${esc(spec.title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
/* Layout: one reading column of numbered step cards; each card is a checklist row with the paste material under it. */
:root {
  --bg: #f6f5f1;
  --card: #ffffff;
  --fg: #1f2a24;
  --muted: #5d6a63;
  --line: #d9ddd6;
  --accent: #2f6b45;
  --accent-fg: #ffffff;
  --accent-soft: #e5efe7;
  --kbd-bg: #eceee9;
  --code-bg: #f0f2ee;
  --done: #8a958e;
  --font-body: "Public Sans", "Segoe UI", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #171b19; --card: #1f2522; --fg: #e8ebe6; --muted: #a3ada6; --line: #343c37;
    --accent: #6fb088; --accent-fg: #0f1a13; --accent-soft: #24352a; --kbd-bg: #2a312d; --code-bg: #161a18; --done: #6e7873;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #171b19; --card: #1f2522; --fg: #e8ebe6; --muted: #a3ada6; --line: #343c37;
  --accent: #6fb088; --accent-fg: #0f1a13; --accent-soft: #24352a; --kbd-bg: #2a312d; --code-bg: #161a18; --done: #6e7873;
  color-scheme: dark;
}
body { background: var(--bg); color: var(--fg); font-family: var(--font-body); font-size: 17px; line-height: 1.5; padding-inline: 16px; padding-block: 24px 64px; }
main { max-width: 720px; margin: 0 auto; display: grid; gap: 28px; }
header h1 { font-size: 1.9rem; line-height: 1.15; margin: 0 0 6px; text-wrap: balance; }
header .sub { color: var(--muted); margin: 0 0 14px; font-size: 1.05rem; }
header p { margin: 0 0 10px; max-width: 65ch; }
.progress { display: flex; align-items: center; gap: 12px; font-size: 0.95rem; color: var(--muted); margin-top: 6px; font-variant-numeric: tabular-nums; }
.progress .bar { flex: 1; height: 8px; background: var(--line); border-radius: 4px; overflow: hidden; }
.progress .bar i { display: block; height: 100%; width: 0; background: var(--accent); transition: width .2s; }
.progress .clear { font: inherit; font-size: 0.85rem; color: var(--muted); background: none; border: 1px solid var(--line); border-radius: 6px; padding: 3px 9px; cursor: pointer; white-space: nowrap; }
.progress .clear:hover { color: var(--fg); border-color: var(--muted); }
.group h2 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin: 0 0 10px; }
.steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
.step { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 14px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 16px; }
.step.done .text, .step.done .note, .step.done .lines { color: var(--done); }
.step.done .text { text-decoration: line-through; text-decoration-color: var(--line); }
.tick { position: relative; display: block; width: 36px; height: 36px; cursor: pointer; }
.tick input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
.tick .box { position: absolute; inset: 0; border: 2px solid var(--muted); border-radius: 8px; background: var(--card); }
.tick input:checked + .box { background: var(--accent); border-color: var(--accent); }
.tick input:checked + .box::after { content: ""; position: absolute; left: 11px; top: 5px; width: 9px; height: 17px; border: solid var(--accent-fg); border-width: 0 3px 3px 0; transform: rotate(45deg); }
.tick input:focus-visible + .box { outline: 3px solid var(--accent); outline-offset: 2px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.body { min-width: 0; display: grid; gap: 10px; }
.text, .note, .lines { margin: 0; }
.num { font-weight: 700; color: var(--accent); }
.text a, .note a { color: var(--accent); font-weight: 600; text-underline-offset: 2px; }
.note, .lines { color: var(--muted); font-size: 0.97rem; }
kbd { font-family: var(--font-mono); font-size: 0.85em; background: var(--kbd-bg); border: 1px solid var(--line); border-bottom-width: 2px; border-radius: 6px; padding: 1px 7px; white-space: nowrap; }
code { font-family: var(--font-mono); font-size: 0.9em; background: var(--code-bg); border-radius: 5px; padding: 1px 5px; }
.file-actions { display: flex; flex-wrap: wrap; gap: 10px; }
button { font: inherit; font-weight: 600; border-radius: 10px; padding: 12px 18px; cursor: pointer; border: 1px solid var(--line); background: var(--card); color: var(--fg); }
button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
button.copy { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
button.copy.copied { background: var(--accent-soft); color: var(--fg); }
pre.code { margin: 0; font-family: var(--font-mono); font-size: 12.5px; line-height: 1.45; background: var(--code-bg); border: 1px solid var(--line); border-radius: 10px; padding: 12px; max-height: 420px; overflow: auto; white-space: pre; }
.fallback { position: fixed; left: -9999px; top: 0; }
@media (prefers-reduced-motion: reduce) { .progress .bar i { transition: none; } }
@media (max-width: 480px) { body { font-size: 16px; } .step { padding: 14px; gap: 10px; } }
</style>
<main>
  <header>
    <h1>${esc(spec.title)}</h1>
    ${spec.subtitle ? `<p class="sub">${marks(spec.subtitle)}</p>` : ""}
    ${intro}
    <div class="progress"><div class="bar"><i id="bar"></i></div><span id="count">0 of ${stepNumber} done</span>` +
    `<button type="button" class="clear" id="clear">Clear all checkmarks</button></div>
  </header>
  ${sectionsHtml.join("\n")}
</main>
<textarea class="fallback" id="fallback" aria-hidden="true" tabindex="-1"></textarea>
<script>
(function () {
  var FILES = ${filesJson};
  var KEY = ${JSON.stringify(pageKey)};
  var total = ${stepNumber};

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function save(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  var state = load();

  function refresh() {
    var done = 0;
    document.querySelectorAll(".step").forEach(function (li) {
      var box = li.querySelector("input[type=checkbox]");
      var on = !!state[box.getAttribute("data-step")];
      box.checked = on;
      li.classList.toggle("done", on);
      if (on) done++;
    });
    document.getElementById("count").textContent = done + " of " + total + " done";
    document.getElementById("bar").style.width = (total ? (100 * done / total) : 0) + "%";
  }
  document.getElementById("clear").addEventListener("click", function () {
    state = {};
    save(state);
    refresh();
  });
  document.querySelectorAll("input[type=checkbox]").forEach(function (box) {
    box.addEventListener("change", function () {
      state[box.getAttribute("data-step")] = box.checked;
      save(state);
      refresh();
    });
  });

  document.querySelectorAll("button.copy").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var file = FILES[Number(btn.getAttribute("data-file"))];
      var label = btn.textContent;
      function ok() { btn.classList.add("copied"); btn.textContent = "Copied. Now paste into " + file.name; setTimeout(function () { btn.classList.remove("copied"); btn.textContent = label; }, 4000); }
      function fallback() {
        var ta = document.getElementById("fallback");
        ta.value = file.text; ta.focus(); ta.select();
        var done = false;
        try { done = document.execCommand("copy"); } catch (e) {}
        if (done) ok(); else { btn.textContent = "Copy blocked here. Use Show code, click inside, Ctrl+A, Ctrl+C."; }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(file.text).then(ok, fallback);
      } else {
        fallback();
      }
    });
  });

  document.querySelectorAll("button.show").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var i = btn.getAttribute("data-file");
      var pre = document.querySelector('pre.code[data-file="' + i + '"]');
      var open = !pre.hidden;
      if (!open && !pre.textContent) pre.textContent = FILES[Number(i)].text;
      pre.hidden = open;
      btn.setAttribute("aria-expanded", String(!open));
      btn.textContent = open ? "Show code" : "Hide code";
    });
  });

  refresh();
})();
</script>
`;

fs.writeFileSync(outPath, html);
const bytes = Buffer.byteLength(html);
console.log("Wrote " + outPath + " (" + stepNumber + " steps, " + files.length + " files, " + Math.round(bytes / 1024) + " KB)");
