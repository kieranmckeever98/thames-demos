/* ============================================================================
   Focus Area 03 — AI Report QA Checker (v2) · cursor-led, camera-driven demo
   ① the surveyor captures the survey in TEAMS on a tablet (rough note)
   ② the agent rewrites the note clean — facts kept verbatim
   ③ it walks the FULL UKAS report — Front · S1 Survey Details · S2 Executive
      Summary · S3 Survey Information · S4 Survey Results · S5 Bulk Analysis ·
      S6 Appendices — each flipping Checking → Checked, the MRA 12-point score
      computing and flagging the high-risk item red, the rail progress filling
   ④ QA passed — the accredited analyst still signs
   No deps. Auto-plays, loops. Honours prefers-reduced-motion.
   ========================================================================== */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const stage = $("#stage"), camera = $("#camera");
  const hed = $("#hed"), hedT = $("#hedT");
  const stepEls = {}; $$("#steps .step").forEach((el) => { stepEls[el.dataset.s] = el; });
  const cursor = $("#cursor");
  const startQA = $("#startQA");
  const reportView = $(".report-view"), reportDoc = $("#reportDoc");
  const BLOCKS = ["repFront", "repS1", "repS2", "repS3", "repS4", "repS5", "repS6"].map((id) => $("#" + id));
  const sumHi = $("#sumHi");
  const mraRows = [$("#mraRow1"), $("#mraRow2"), $("#mraRow3"), $("#mraRow4")];
  const mraTotal = $("#mraTotal"), mraAction = $("#mraAction");
  const railFg = $("#railFg"), railNum = $("#railNum"), railFlag = $("#railFlag");
  const editCount = $("#editCount");
  let editsMade = 0, flags = 0;
  function updateCounts() { editCount.innerHTML = "Edits: <b>" + editsMade + "</b> · Flags: <b>" + flags + "</b>"; }
  function chgShow(id) { const e = document.getElementById(id); if (e) e.classList.add("show"); }
  function edit(elId) { const e = document.getElementById(elId); if (e) e.classList.add("edited"); }
  const qaOut = $("#qaOut");
  const counterEl = $("#counter"), replayBtn = $("#replay");
  const RING_C = 113;

  const HED = {
    1: "TEAMS has produced the report — it's <b>queued for QA</b>.",
    2: "The agent checks <b>every section</b> against the rules.",
    3: "It re-scores the risk and <b>flags the high-risk item</b>.",
    4: "QA passed — the <b>accredited analyst still signs</b>.",
  };
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let gen = 0, timers = [], hedTimer = null, rafs = [];
  function clearTimers() { timers.forEach(clearTimeout); timers = []; rafs.forEach(cancelAnimationFrame); rafs = []; if (hedTimer) { clearTimeout(hedTimer); hedTimer = null; } }

  // ── camera ──
  let stageW = 0, stageH = 0, camZ = 1, camX = 0, camY = 0, curX = 0, curY = 0, headClear = 150;
  const POS = {}, ROI = {}, CARDTOP = {};
  function centreOf(el, cr) { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2 }; }
  function measure() {
    const prev = camera.style.transform; camera.style.transform = "none";
    const prevStep = stage.dataset.step; stage.classList.add("measuring");
    const cr = camera.getBoundingClientRect(); stageW = cr.width; stageH = cr.height;
    const m = (el) => centreOf(el, cr); const topOf = (el) => (el ? el.getBoundingClientRect().top - cr.top : 0);
    stage.dataset.step = "1"; ROI.queue = m($("#sceneQueue")); POS.startQA = m(startQA); CARDTOP["1"] = topOf($("#sceneQueue"));
    stage.dataset.step = "3";
    ROI.report = m($("#sceneReport")); ROI.doc = m(reportView); ROI.rail = m($(".report-rail")); ROI.out = m(qaOut);
    POS.doc = m(reportView); POS.rail = m($(".report-rail"));
    CARDTOP["2"] = CARDTOP["3"] = CARDTOP["4"] = topOf($("#sceneReport"));
    stage.dataset.step = "payoff"; ROI.payoff = m($("#scenePayoff")); CARDTOP["payoff"] = topOf($("#scenePayoff"));
    headClear = (hed.getBoundingClientRect().bottom - cr.top) + 14;
    stage.dataset.step = prevStep || "0"; stage.classList.remove("measuring"); camera.style.transform = prev;
  }
  function applyCamera() { camera.style.transform = `translate(${stageW / 2 - camZ * camX}px, ${stageH / 2 - camZ * camY}px) scale(${camZ})`; }
  function applyCursor() { cursor.style.transform = `translate(${curX - 3}px, ${curY - 2}px) scale(${1 / camZ})`; }
  function zoomTo(roi, z, dur) {
    const p = (typeof roi === "string") ? ROI[roi] : roi; if (!p) return;
    camZ = z; camX = p.x; camY = p.y;
    const ct = CARDTOP[stage.dataset.step];
    if (ct != null) { const maxY = (stageH / 2 + camZ * ct - headClear) / camZ; if (camY > maxY) camY = maxY; }
    camera.style.transitionDuration = (dur != null ? dur : 1300) + "ms"; applyCamera(); applyCursor();
  }
  function moveCursor(id) { const p = (typeof id === "string") ? POS[id] : id; if (!p) return; curX = p.x; curY = p.y; applyCursor(); }

  // ── report doc scroll ──
  function scrollToBlock(el) {
    if (!el) return;
    const viewH = reportView.clientHeight;
    const maxScroll = Math.max(0, reportDoc.scrollHeight - viewH);
    const y = Math.min(Math.max(0, el.offsetTop - 10), maxScroll);
    reportDoc.style.transform = `translateY(${-y}px)`;
  }

  // ── helpers ──
  function setHed(step, fade = true) { const t = HED[step] || ""; if (hedTimer) { clearTimeout(hedTimer); hedTimer = null; } if (!fade) { hedT.innerHTML = t; return; } hed.classList.add("swap"); hedTimer = setTimeout(() => { hedT.innerHTML = t; hed.classList.remove("swap"); }, 220); }
  function markSteps(active) { for (let i = 1; i <= 4; i++) { const el = stepEls[i]; if (!el) continue; el.classList.toggle("done", active === "all" || (typeof active === "number" && i < active)); el.classList.toggle("now", typeof active === "number" && i === active); } }
  function setMra(v) { if (mraTotal.childNodes[0]) mraTotal.childNodes[0].nodeValue = String(v); }
  function setProgress(n) { railFg.style.strokeDashoffset = String(RING_C * (1 - n / 7)); railNum.textContent = n + " / 7"; }
  function countNum(setter, from, to, dur, my) { const t0 = performance.now(); const tick = () => { if (my !== gen) return; const k = Math.min(1, (performance.now() - t0) / dur); setter(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 2)))); if (k < 1) rafs.push(requestAnimationFrame(tick)); }; tick(); }

  function reset() {
    stage.dataset.step = "0";
    camZ = 1; camX = stageW / 2 || 0; camY = stageH / 2 || 0;
    camera.style.transition = "none"; applyCamera();
    cursor.classList.remove("on", "click"); curX = stageW / 2 || 0; curY = (stageH || 0) * 0.82; applyCursor();
    requestAnimationFrame(() => { camera.style.transition = ""; });
    startQA.classList.remove("tapped");
    reportDoc.style.transition = "none"; reportDoc.style.transform = "translateY(0)"; requestAnimationFrame(() => { reportDoc.style.transition = ""; });
    BLOCKS.forEach((b) => b.classList.remove("checking", "checked"));
    ["edAuth", "edComment", "edBasis", "sumHi"].forEach((id) => { const e = document.getElementById(id); if (e) e.classList.remove("edited", "editing"); });
    { const ph = $("#photoS07"); if (ph) ph.classList.remove("scanning", "verified"); }
    $$("#changes .chg").forEach((c) => c.classList.remove("show"));
    sumHi.classList.remove("flag"); railFlag.classList.remove("show");
    mraRows.forEach((r) => r.classList.remove("show")); setMra(0); mraTotal.classList.remove("hi"); mraAction.classList.remove("show");
    editsMade = 0; flags = 0; updateCounts();
    setProgress(0); qaOut.classList.remove("show", "signed");
    markSteps(0); counterEl.textContent = "0";
    setHed(1, false); hed.classList.remove("swap");
  }
  function showFinished() { reset(); stage.dataset.step = "payoff"; markSteps("all"); counterEl.textContent = "7"; }

  // effects fired when a given block finishes checking
  // the agent makes an in-place edit to the report (mid-check)
  function doBlockEdit(id) {
    let edId = null, chgId = null;
    if (id === "repS2") { edId = "sumHi"; chgId = "chgS2"; sumHi.classList.add("flag"); flags = 1; }
    else if (id === "repS4") { edId = "edComment"; chgId = "chgS4"; }
    else if (id === "repS5") { edId = "edBasis"; chgId = "chgS5"; }
    if (!edId) return;
    const e = document.getElementById(edId);
    if (e) { e.classList.add("edited", "editing"); timers.push(setTimeout(() => e.classList.remove("editing"), 950)); }
    cursor.classList.add("click"); timers.push(setTimeout(() => cursor.classList.remove("click"), 500));
    chgShow(chgId); editsMade += 1; updateCounts();
  }
  // final per-section effects (at "checked")
  function finalEffect(id) {
    if (id === "repS6") { mraTotal.classList.add("hi"); mraAction.classList.add("show"); railFlag.classList.add("show"); }
  }

  // ── timeline ──
  function buildTimeline(my) {
    const tl = [
      [0, () => reset()],
      [320, () => { stage.dataset.step = "1"; markSteps(1); setHed(1, false); cursor.classList.add("on"); zoomTo("queue", 1.0, 850); }],
      [1500, () => { moveCursor("startQA"); zoomTo("queue", 1.12); }],
      [2400, () => { startQA.classList.add("tapped"); cursor.classList.add("click"); timers.push(setTimeout(() => cursor.classList.remove("click"), 500)); }],
      [3200, () => { stage.dataset.step = "2"; markSteps(2); setHed(2); zoomTo("report", 1.0, 850); moveCursor("doc"); }],
    ];
    // walk every section — verify each line, slow & thorough
    let t = 4400;
    const hasEdit = { repS2: 1, repS4: 1, repS5: 1 };
    BLOCKS.forEach((b, i) => {
      const dwell = b.id === "repS4" ? 2900 : (hasEdit[b.id] ? 2100 : 1350);
      tl.push([t, () => {
        if (b.id === "repS5") { stage.dataset.step = "3"; markSteps(3); setHed(3); }
        scrollToBlock(b); b.classList.add("checking"); moveCursor("doc");
      }]);
      if (hasEdit[b.id]) tl.push([t + 1050, () => { doBlockEdit(b.id); }]);
      if (b.id === "repS4") {
        tl.push([t + 1750, () => { const p = $("#photoS07"); if (p) p.classList.add("scanning"); cursor.classList.add("click"); timers.push(setTimeout(() => cursor.classList.remove("click"), 500)); }]);
        tl.push([t + 2350, () => { const p = $("#photoS07"); if (p) p.classList.add("verified"); chgShow("chgPhoto"); }]);
      }
      if (b.id === "repS6") tl.push([t + 240, () => { mraRows.forEach((r, k) => timers.push(setTimeout(() => { if (my === gen) r.classList.add("show"); }, k * 280))); countNum(setMra, 0, 11, 1600, my); }]);
      tl.push([t + dwell, () => { b.classList.remove("checking"); b.classList.add("checked"); setProgress(i + 1); finalEffect(b.id); }]);
      t += dwell + 460;
    });
    // sign-off
    tl.push([t + 300, () => { stage.dataset.step = "4"; markSteps(4); setHed(4); zoomTo("out", 1.24); moveCursor("rail"); qaOut.classList.add("show"); }]);
    tl.push([t + 1200, () => { qaOut.classList.add("signed"); edit("edAuth"); editsMade += 1; chgShow("chgS1"); updateCounts(); }]);
    tl.push([t + 2600, () => { zoomTo("report", 1.0, 850); cursor.classList.remove("on"); }]);
    const pay = t + 4600;
    tl.push([pay, () => { stage.dataset.step = "payoff"; markSteps("all"); zoomTo("payoff", 1.0, 850); countNum((v) => (counterEl.textContent = v), 0, 7, 1200, my); }]);
    tl.push([pay + 4200, () => { stage.dataset.step = "0"; }]);
    tl.push([pay + 4500, () => { run(); }]);
    return tl;
  }

  function run() {
    if (REDUCED) { showFinished(); return; }
    gen += 1; const my = gen; clearTimers();
    buildTimeline(my).forEach(([ms, fn]) => timers.push(setTimeout(() => { if (my === gen) fn(); }, ms)));
  }

  // ── freeze (verification): ?freeze=1|2|3|4|payoff ──
  function freezeAt(step) {
    gen += 1; clearTimers(); stage.classList.add("measuring"); measure(); reset(); stage.classList.add("frozen"); stage.dataset.step = (step === "s4") ? "3" : step; cursor.classList.remove("on");
    if (step === "1") { startQA.classList.add("tapped"); markSteps(1); setHed(1, false); }
    if (step === "2" || step === "3" || step === "4" || step === "s4") {
      BLOCKS.forEach((b) => b.classList.add("checked")); sumHi.classList.add("flag"); railFlag.classList.add("show");
      ["sumHi", "edComment", "edBasis"].forEach((id) => edit(id)); if (step === "4") edit("edAuth");
      { const ph = document.getElementById("photoS07"); if (ph) ph.classList.add("verified"); }
      $$("#changes .chg").forEach((c) => { if (c.id !== "chgS1" || step === "4") c.classList.add("show"); });
      editsMade = step === "4" ? 4 : 3; flags = 1; updateCounts();
      mraRows.forEach((r) => r.classList.add("show")); setMra(11); mraTotal.classList.add("hi"); mraAction.classList.add("show");
      setProgress(7);
      const stp = step === "4" ? 4 : (step === "3" ? 3 : 2); markSteps(stp); setHed(stp, false);
      scrollToBlock(step === "2" ? $("#repS2") : (step === "s4" ? $("#repS4") : $("#repS6")));
      if (step === "4") qaOut.classList.add("show", "signed");
    }
    if (step === "payoff") { markSteps("all"); counterEl.textContent = "7"; }
    const roiMap = { "1": "queue", "2": "report", "3": "report", "4": "report", "s4": "report", "payoff": "payoff" };
    camera.style.transition = "none"; zoomTo(roiMap[step] || "queue", 1.0, 0);
  }

  replayBtn.addEventListener("click", () => { run(); });
  let rT; window.addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(() => { const t = camera.style.transition; camera.style.transition = "none"; measure(); applyCamera(); applyCursor(); requestAnimationFrame(() => { camera.style.transition = t; }); }, 200); });

  let booted = false;
  function boot() {
    if (booted) return; booted = true; measure();
    const fz = new URLSearchParams(location.search).get("freeze");
    if (fz) { freezeAt(fz); return; }
    if (REDUCED) { showFinished(); return; }
    reset(); run();
  }
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(boot); setTimeout(boot, 1200); }
  else { boot(); }
})();
