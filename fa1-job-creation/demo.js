/* ============================================================================
   Focus Area 01 — Job Creation · cursor-led, camera-driven demo
   ① an order email arrives in Gmail · the agent opens the instruction PDF
   ② it reads the instruction line by line
   ③ it drafts the job in Theo's New Job screen — fields fill in
   ④ it confirms — Submit · "ready to confirm" · the payoff counter
   No deps. Auto-plays, loops. Honours prefers-reduced-motion.
   ========================================================================== */
(() => {
  "use strict";
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const stage   = $("#stage");
  const camera  = $("#camera");
  const hed     = $("#hed"), hedT = $("#hedT");
  const stepEls = {}; $$("#steps .step").forEach((el) => { stepEls[el.dataset.s] = el; });
  const cursor  = $("#cursor");
  const gmHot   = $("#gmHot"), gmAtt = $("#gmAtt");
  const pdfRows = {}; $$("#scenePdf [data-f]").forEach((el) => { pdfRows[el.dataset.f] = el; });
  const tfEls   = {
    batch: $("#tfBatch"), site: $("#tfSite"), contact: $("#tfContact"), phone: $("#tfPhone"),
    email: $("#tfEmail"), po: $("#tfPo"), work: $("#tfWork"), sor: $("#tfSor"), rate: $("#tfRate"),
  };
  const tfLinks  = $("#tfLinks");
  const theoChip = $("#theoChip"), theoSubmit = $("#theoSubmit");
  const counterEl = $("#counter"), replayBtn = $("#replay");

  const HED = {
    1: "An asbestos survey order lands in the inbox.",
    2: "The agent reads the instruction — UPRN, address, scope.",
    3: "It <b>drafts the job in Theo</b> — nested &amp; SOR-rated.",
    4: "Ready for the admin to confirm — in seconds.",
  };
  const PDF_ORDER = ["client", "uprn", "address", "surveytype", "purpose", "element"];
  const TF_ORDER  = ["batch", "site", "contact", "phone", "email", "po", "work", "sor", "rate"];

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let gen = 0, timers = [], hedTimer = null;
  function clearTimers() { timers.forEach(clearTimeout); timers = []; if (hedTimer) { clearTimeout(hedTimer); hedTimer = null; } }

  // ── camera + measured positions ──
  let stageW = 0, stageH = 0, camZ = 1, camX = 0, camY = 0;
  let curX = 0, curY = 0, headClear = 150;
  const POS = {}, ROI = {}, CARDTOP = {};

  function centreOf(el, cr) { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2 }; }
  function measure() {
    const prev = camera.style.transform; camera.style.transform = "none";
    const prevStep = stage.dataset.step;
    const wasArrived = gmHot.classList.contains("arrived");
    stage.classList.add("measuring");
    gmHot.classList.add("arrived");
    const cr = camera.getBoundingClientRect(); stageW = cr.width; stageH = cr.height;
    const m = (el) => centreOf(el, cr);
    const topOf = (el) => { if (!el) return 0; return el.getBoundingClientRect().top - cr.top; };

    stage.dataset.step = "1";
    POS.gmAtt = m(gmAtt);
    ROI.inbox = m($("#sceneInbox")); ROI.inboxHot = m(gmHot); ROI.inboxAtt = m(gmAtt);
    CARDTOP["1"] = topOf($("#sceneInbox"));

    stage.dataset.step = "2";
    PDF_ORDER.forEach((f) => { POS["pdf_" + f] = m(pdfRows[f]); });
    ROI.pdf = m($("#scenePdf")); ROI.pdfData = m($("#scenePdf .pdf-grid"));
    CARDTOP["2"] = topOf($("#scenePdf"));

    stage.dataset.step = "3";
    TF_ORDER.forEach((f) => { POS["tf_" + f] = m(tfEls[f]); });
    ROI.theo = m($("#sceneTheo")); ROI.theoTop = m($("#tfSite")); ROI.theoJob = m($("#tfSor"));
    CARDTOP["3"] = topOf($("#sceneTheo"));

    stage.dataset.step = "4";
    POS.submit = m(theoSubmit);
    ROI.theoFoot = m($(".theo-foot")); ROI.theoActions = m(theoSubmit);
    CARDTOP["4"] = topOf($("#sceneTheo"));

    stage.dataset.step = "payoff";
    ROI.payoff = m($("#scenePayoff"));
    CARDTOP["payoff"] = topOf($("#scenePayoff"));

    headClear = (hed.getBoundingClientRect().bottom - cr.top) + 14;
    stage.dataset.step = prevStep || "0";
    if (!wasArrived) gmHot.classList.remove("arrived");
    stage.classList.remove("measuring");
    camera.style.transform = prev;
  }
  function applyCamera() { camera.style.transform = `translate(${stageW / 2 - camZ * camX}px, ${stageH / 2 - camZ * camY}px) scale(${camZ})`; }
  function applyCursor() { cursor.style.transform = `translate(${curX - 3}px, ${curY - 2}px) scale(${1 / camZ})`; }
  function zoomTo(roi, z, dur) {
    const p = (typeof roi === "string") ? ROI[roi] : roi;
    if (!p) return;
    camZ = z; camX = p.x; camY = p.y;
    const ct = CARDTOP[stage.dataset.step];
    if (ct != null) { const maxY = (stageH / 2 + camZ * ct - headClear) / camZ; if (camY > maxY) camY = maxY; }
    camera.style.transitionDuration = (dur != null ? dur : 1300) + "ms";
    applyCamera(); applyCursor();
  }
  function moveCursor(id) { const p = POS[id]; if (!p) return; curX = p.x; curY = p.y; applyCursor(); }
  function clickCursor(el) {
    cursor.classList.add("click");
    timers.push(setTimeout(() => cursor.classList.remove("click"), 520));
    if (el) { el.classList.add("tapped"); timers.push(setTimeout(() => el.classList.remove("tapped"), 600)); }
  }

  // ── helpers ──
  function setHed(step, fade = true) {
    const t = HED[step] || "";
    if (hedTimer) { clearTimeout(hedTimer); hedTimer = null; }
    if (!fade) { hedT.innerHTML = t; return; }
    hed.classList.add("swap");
    hedTimer = setTimeout(() => { hedT.innerHTML = t; hed.classList.remove("swap"); }, 220);
  }
  function markSteps(active) {
    for (let i = 1; i <= 4; i++) {
      const el = stepEls[i]; if (!el) continue;
      el.classList.toggle("done", active === "all" || (typeof active === "number" && i < active));
      el.classList.toggle("now",  typeof active === "number" && i === active);
    }
  }
  function fillTf(f) {
    const el = tfEls[f]; if (!el) return;
    el.classList.remove("empty"); el.classList.add("filled", "flash");
    timers.push(setTimeout(() => el.classList.remove("flash"), 900));
  }

  // ── counter ──
  let countRAF = null;
  function countUp(target, dur) {
    stopCount(); const t0 = performance.now();
    const tick = () => { const k = Math.min(1, (performance.now() - t0) / dur);
      counterEl.textContent = (target * (1 - Math.pow(1 - k, 2.4))).toFixed(1);
      if (k < 1) countRAF = requestAnimationFrame(tick); else counterEl.textContent = target.toFixed(1); };
    tick();
  }
  function stopCount() { if (countRAF) cancelAnimationFrame(countRAF); countRAF = null; }

  // ── reset ──
  function reset() {
    stage.dataset.step = "0";
    camZ = 1; camX = stageW / 2 || 0; camY = stageH / 2 || 0;
    camera.style.transition = "none"; applyCamera();
    cursor.classList.remove("on", "click"); curX = stageW / 2 || 0; curY = (stageH || 0) * 0.86; applyCursor();
    requestAnimationFrame(() => { camera.style.transition = ""; });
    gmHot.classList.remove("arrived", "lit"); gmAtt.classList.remove("tapped");
    Object.values(pdfRows).forEach((el) => el.classList.remove("lit"));
    Object.values(tfEls).forEach((el) => { el.classList.remove("filled", "flash"); el.classList.add("empty"); });
    tfLinks.classList.remove("show"); theoChip.classList.remove("show"); theoSubmit.classList.remove("tapped");
    markSteps(0); stopCount(); counterEl.textContent = "0.0";
    setHed(1, false); hed.classList.remove("swap");
  }
  function showFinished() { reset(); stage.dataset.step = "payoff"; markSteps("all"); counterEl.textContent = "11.0"; }

  // ── timeline ──
  function buildTimeline() {
    const tl = [
      [0,    () => reset()],
      [320,  () => { stage.dataset.step = "1"; markSteps(1); setHed(1, false); cursor.classList.add("on"); zoomTo("inbox", 1.0, 850); }],
      [760,  () => { gmHot.classList.add("arrived"); }],
      [1750, () => { moveCursor("gmAtt"); gmHot.classList.add("lit"); }],
      [2750, () => { moveCursor("gmAtt"); zoomTo("inboxAtt", 1.3); }],
      [3850, () => { clickCursor(gmAtt); }],

      // ── scene 2 — the instruction ──
      [4150, () => { stage.dataset.step = "2"; markSteps(2); setHed(2); zoomTo("pdf", 1.0, 850); }],
      [5550, () => { zoomTo("pdfData", 1.22); }],
    ];
    PDF_ORDER.forEach((f, i) => {
      const t = 6500 + i * 430;
      tl.push([t,       () => { moveCursor("pdf_" + f); }]);
      tl.push([t + 260, () => { pdfRows[f].classList.add("lit"); }]);
    });
    // last lit ~9250

    tl.push([10100, () => { stage.dataset.step = "3"; markSteps(3); setHed(3); zoomTo("theo", 1.0, 850); }]);
    tl.push([11050, () => { zoomTo("theoTop", 1.16); }]);
    tl.push([11550, () => { fillTf("batch"); }]);
    tl.push([11950, () => { fillTf("site"); }]);
    tl.push([12350, () => { tfLinks.classList.add("show"); }]);
    tl.push([12850, () => { zoomTo("theoJob", 1.14); }]);
    ["contact", "phone", "email", "po", "work", "sor", "rate"].forEach((f, i) => {
      tl.push([13200 + i * 300, () => fillTf(f)]);
    });
    // last fill ~15300

    tl.push(
      // ── scene 4 — confirm ──
      [16000, () => { stage.dataset.step = "4"; markSteps(4); setHed(4); zoomTo("theoFoot", 1.2, 850); }],
      [16900, () => { theoChip.classList.add("show"); }],
      [17700, () => { moveCursor("submit"); }],
      [18350, () => { clickCursor(theoSubmit); }],
      [19000, () => { zoomTo("theo", 1.0, 850); }],

      // ── payoff ──
      [21100, () => { stage.dataset.step = "payoff"; markSteps("all"); cursor.classList.remove("on"); zoomTo("payoff", 1.0, 850); countUp(11.0, 1700); }],
      [25200, () => { stage.dataset.step = "0"; }],
      [25500, () => { run(); }],
    );
    return tl;
  }

  function run() {
    if (REDUCED) { showFinished(); return; }
    gen += 1; const myGen = gen;
    clearTimers(); stopCount();
    buildTimeline().forEach(([ms, fn]) => { timers.push(setTimeout(() => { if (myGen === gen) fn(); }, ms)); });
  }

  replayBtn.addEventListener("click", () => { reset(); run(); });
  let rT; window.addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(() => { const t = camera.style.transition; camera.style.transition = "none"; measure(); applyCamera(); applyCursor(); requestAnimationFrame(() => { camera.style.transition = t; }); }, 200); });

  // ── freeze mode (screenshot verification): ?freeze=1|2|3|4|payoff ──
  function freezeAt(step) {
    reset();
    stage.dataset.step = step;
    if (step === "2") { Object.values(pdfRows).forEach((el) => el.classList.add("lit")); markSteps(2); setHed(2, false); }
    if (step === "1") { gmHot.classList.add("arrived", "lit"); markSteps(1); setHed(1, false); }
    if (step === "3" || step === "4") {
      Object.values(tfEls).forEach((el) => { el.classList.remove("empty"); el.classList.add("filled"); });
      tfLinks.classList.add("show"); markSteps(step === "4" ? 4 : 3); setHed(step, false);
      if (step === "4") theoChip.classList.add("show");
    }
    if (step === "payoff") { markSteps("all"); counterEl.textContent = "11.0"; }
    const roiMap = { "1": "inbox", "2": "pdf", "3": "theo", "4": "theo", "payoff": "payoff" };
    camera.style.transition = "none";
    zoomTo(roiMap[step] || "inbox", 1.0, 0);
    cursor.classList.remove("on");
  }

  let booted = false;
  function boot() {
    if (booted) return; booted = true; measure();
    const fz = new URLSearchParams(location.search).get("freeze");
    if (fz) { freezeAt(fz); return; }
    if (REDUCED) { showFinished(); return; } reset(); run();
  }
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(boot); setTimeout(boot, 1200); }
  else { boot(); }
})();
