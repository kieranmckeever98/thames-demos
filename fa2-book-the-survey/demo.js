/* ============================================================================
   Focus Area 02 — Diary & Appointment Setting · cursor-led, camera-driven demo
   WITH audio: the agent makes a real AI voice call to the resident — a full,
   realistic booking conversation you can hear. Two voices, each transcript
   line spoken and synced to its bubble, the captured fields filling as they
   speak, then the booking written into Theo.
   Audio: plays pre-rendered audio/NN.mp3 if present (ElevenLabs), otherwise
   falls back to the browser's built-in speech voice. Click "Hear the call".
   The visual loop auto-plays muted; honours prefers-reduced-motion.
   ========================================================================== */
(() => {
  "use strict";
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pad2 = (n) => (n < 10 ? "0" : "") + n;

  // ── the conversation ──
  const LINES = [
    { who: "agent", text: "Good morning, am I speaking with David Hartley?" },
    { who: "res",   text: "Yes, that's me. Who's calling?" },
    { who: "agent", text: "Hi David, this is Thames Laboratories, calling on behalf of Greenholting about the asbestos survey that's due at your property on Burley Court. Have you got a couple of minutes?" },
    { who: "res",   text: "Yeah, go on." },
    { who: "agent", text: "Thank you. Just to reassure you, it's a routine management survey your landlord arranges to keep the asbestos records up to date. It isn't intrusive, the surveyor only needs access for around thirty to forty-five minutes." },
    { who: "res",   text: "Okay, that's fine." },
    { who: "agent", text: "Before I book it in, just for data protection, could you confirm the first line of your address and your postcode?" },
    { who: "res",   text: "Sure, it's 2129 Burley Court, postcode B12 9QX.", cap: 0 },
    { who: "agent", text: "Perfect, thank you. I've got availability this Thursday the eleventh, at around nine-forty in the morning. Would that work for you?" },
    { who: "res",   text: "Thursday's no good for me I'm afraid, I'm away with work all week." },
    { who: "agent", text: "Not a problem at all, David. Let me take a look at what else we have. I could do the following Tuesday, the sixteenth, at around ten in the morning, or a Wednesday afternoon if that's easier. Which would suit you?" },
    { who: "res",   text: "Tuesday morning's better. Although I'll be at work, mind.", cap: 1 },
    { who: "agent", text: "That's fine. Is there a way the surveyor can get access while you're out, a key safe or a neighbour perhaps?" },
    { who: "res",   text: "There's a key safe by the side gate." },
    { who: "agent", text: "Great. Could I take the code, so I can pass it securely to the surveyor?" },
    { who: "res",   text: "Yeah, it's four, four, seven, one.", cap: 2 },
    { who: "agent", text: "Lovely, thank you. And is there anything they should know when they arrive, any pets, or anyone vulnerable in the home?" },
    { who: "res",   text: "Just the dog, but he'll be shut in the kitchen.", cap: 3 },
    { who: "agent", text: "Noted, I'll let the surveyor know. And the last thing, in the past seven days has anyone in the household had a high temperature, a new continuous cough, or tested positive for Covid?" },
    { who: "res",   text: "No, nothing like that.", cap: 4 },
    { who: "agent", text: "That's great. So to confirm, David, your asbestos survey is booked for Tuesday the sixteenth, at around ten in the morning, access via the key safe at the side gate, and I've noted the dog. You'll get a text confirmation shortly. Is there anything else I can help with?" },
    { who: "res",   text: "No, that's everything, thanks.", cap: 5 },
    { who: "agent", text: "Thank you, David. Take care now. Goodbye." },
  ];
  const CAPS = [
    { l: "Identity",      v: "Verified · address & postcode" },
    { l: "Slot · rebooked", v: "Tue 16 Jun · 10:00 AM" },
    { l: "Access",        v: "Key safe · side gate · 4471" },
    { l: "On site",       v: "Dog · shut in kitchen" },
    { l: "Covid check",   v: "Clear · last 7 days" },
    { l: "Consent",       v: "Given · booking confirmed" },
  ];

  const stage = $("#stage"), camera = $("#camera");
  const hed = $("#hed"), hedT = $("#hedT");
  const stepEls = {}; $$("#steps .step").forEach((el) => { stepEls[el.dataset.s] = el; });
  const cursor = $("#cursor");
  const awaitPill = $("#sceneAwait .await-pill");
  const txWrap = $("#tx"), capWrap = $("#capList");
  const callTimer = $("#callTimer");
  const calBlock = $("#calBlock");
  const recLes = {}; $$("#sceneRecord .rec-le").forEach((el) => { recLes[el.dataset.l] = el; });
  const recSms = $("#recSms"), recChip = $("#recChip");
  const counterEl = $("#counter"), replayBtn = $("#replay"), soundBtn = $("#soundBtn");

  // build transcript + captured rows from data
  const txEls = [], capEls = [];
  LINES.forEach((ln) => {
    const row = document.createElement("div");
    row.className = "tx-row " + (ln.who === "agent" ? "agent" : "res");
    row.innerHTML = `<span class="tx-tag">${ln.who === "agent" ? "AI" : "MH"}</span><div class="bubble">${ln.text}</div>`;
    txWrap.appendChild(row); txEls.push(row);
  });
  CAPS.forEach((c) => {
    const row = document.createElement("div");
    row.className = "cap-row";
    row.innerHTML = `<span class="l">${c.l}</span><span class="v">${c.v}</span>`;
    capWrap.appendChild(row); capEls.push(row);
  });

  const HED = {
    1: "A survey job is waiting to be booked.",
    2: "The agent <b>phones the resident</b> — a real voice call.",
    3: "It captures the slot, access &amp; consent — as they speak.",
    4: "It writes the booking straight into Theo.",
  };
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let gen = 0, timers = [], hedTimer = null, timerInt = null;
  let curAudio = null;
  function clearTimers() { timers.forEach(clearTimeout); timers = []; if (hedTimer) { clearTimeout(hedTimer); hedTimer = null; } stopTimer(); }

  // ── voices ──
  let agentVoice = null, resVoice = null, voicesReady = false;
  function loadVoices() {
    if (!("speechSynthesis" in window)) return;
    const vs = speechSynthesis.getVoices();
    if (!vs.length) return;
    const pick = (prefs) => { for (const p of prefs) { const v = vs.find((x) => (x.name + " " + x.lang).toLowerCase().includes(p)); if (v) return v; } return null; };
    agentVoice = pick(["sonia", "libby", "hazel", "aria", "en-gb", "female", "en-us", "samantha", "en"]) || vs[0];
    resVoice   = pick(["ryan", "george", "guy", "thomas", "daniel", "male", "en-gb", "en-us", "en"]) || vs[0];
    if (resVoice === agentVoice) { const alt = vs.find((x) => x !== agentVoice); if (alt) resVoice = alt; }
    voicesReady = true;
  }
  if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }

  // ── camera / measure ──
  let stageW = 0, stageH = 0, camZ = 1, camX = 0, camY = 0, curX = 0, curY = 0, headClear = 150;
  const POS = {}, ROI = {}, CARDTOP = {};
  function centreOf(el, cr) { if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left - cr.left + r.width / 2, y: r.top - cr.top + r.height / 2 }; }
  function measure() {
    const prev = camera.style.transform; camera.style.transform = "none";
    const prevStep = stage.dataset.step; stage.classList.add("measuring");
    const cr = camera.getBoundingClientRect(); stageW = cr.width; stageH = cr.height;
    const m = (el) => centreOf(el, cr); const topOf = (el) => (el ? el.getBoundingClientRect().top - cr.top : 0);
    stage.dataset.step = "1"; POS.awaitPill = m(awaitPill); ROI.await = m($("#sceneAwait")); CARDTOP["1"] = topOf($("#sceneAwait"));
    stage.dataset.step = "2"; ROI.call = m($("#sceneCall")); ROI.callTx = m($("#tx")); ROI.callCap = m($("#sceneCall .cap")); CARDTOP["2"] = topOf($("#sceneCall")); CARDTOP["3"] = CARDTOP["2"];
    stage.dataset.step = "4"; ROI.record = m($("#sceneRecord")); ROI.recDiary = m($("#sceneRecord .cal-col")); ROI.recLog = m($("#sceneRecord .rec-log")); CARDTOP["4"] = topOf($("#sceneRecord"));
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
  function moveCursor(id) { const p = POS[id]; if (!p) return; curX = p.x; curY = p.y; applyCursor(); }

  // ── timer ──
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function startTimer(fromSec) { stopTimer(); let s = fromSec; callTimer.textContent = "00:" + pad(s); timerInt = setInterval(() => { s += 1; callTimer.textContent = pad(Math.floor(s / 60)) + ":" + pad(s % 60); }, 1000); }
  function stopTimer() { if (timerInt) { clearInterval(timerInt); timerInt = null; } }

  // ── helpers ──
  function setHed(step, fade = true) {
    const t = HED[step] || ""; if (hedTimer) { clearTimeout(hedTimer); hedTimer = null; }
    if (!fade) { hedT.innerHTML = t; return; }
    hed.classList.add("swap"); hedTimer = setTimeout(() => { hedT.innerHTML = t; hed.classList.remove("swap"); }, 220);
  }
  function setHedStr(t) { if (hedTimer) { clearTimeout(hedTimer); hedTimer = null; } hed.classList.add("swap"); hedTimer = setTimeout(() => { hedT.innerHTML = t; hed.classList.remove("swap"); }, 220); }
  function markSteps(active) { for (let i = 1; i <= 4; i++) { const el = stepEls[i]; if (!el) continue; el.classList.toggle("done", active === "all" || (typeof active === "number" && i < active)); el.classList.toggle("now", typeof active === "number" && i === active); } }
  function revealLine(i) { txEls.forEach((e) => e.classList.remove("speaking")); txEls[i].classList.add("show"); }
  function fillCap(ci) { if (capEls[ci]) capEls[ci].classList.add("filled"); }

  function reset() {
    stage.dataset.step = "0";
    camZ = 1; camX = stageW / 2 || 0; camY = stageH / 2 || 0;
    camera.style.transition = "none"; applyCamera();
    cursor.classList.remove("on", "click"); curX = stageW / 2 || 0; curY = (stageH || 0) * 0.84; applyCursor();
    requestAnimationFrame(() => { camera.style.transition = ""; });
    txEls.forEach((el) => el.classList.remove("show", "speaking"));
    capEls.forEach((el) => el.classList.remove("filled"));
    Object.values(recLes).forEach((el) => el.classList.remove("show"));
    calBlock.classList.remove("drop"); recSms.classList.remove("show"); recChip.classList.remove("show");
    stopTimer(); callTimer.textContent = "00:00";
    markSteps(0); counterEl.textContent = "1";
    setHed(1, false); hed.classList.remove("swap");
  }
  function showFinished() { reset(); stage.dataset.step = "payoff"; markSteps("all"); }

  // ── speech: one line, file-or-TTS, resolves when finished ──
  function speak(i) {
    return new Promise((resolve) => {
      const line = LINES[i]; let done = false;
      const finish = () => { if (done) return; done = true; resolve(); };
      const fileTimeout = setTimeout(() => fallbackTTS(line, finish), 350); // if file doesn't start, use TTS
      const a = new Audio(`audio/${pad2(i + 1)}.mp3`);
      curAudio = a;
      a.addEventListener("playing", () => clearTimeout(fileTimeout), { once: true });
      a.addEventListener("ended", finish, { once: true });
      a.addEventListener("error", () => { clearTimeout(fileTimeout); fallbackTTS(line, finish); }, { once: true });
      a.play().then(() => clearTimeout(fileTimeout)).catch(() => { clearTimeout(fileTimeout); fallbackTTS(line, finish); });
    });
  }
  function fallbackTTS(line, done) {
    if (!("speechSynthesis" in window)) { setTimeout(done, Math.min(5200, line.text.length * 55 + 900)); return; }
    if (!voicesReady) loadVoices();
    try { speechSynthesis.cancel(); } catch (e) {}
    const u = new SpeechSynthesisUtterance(line.text);
    u.voice = line.who === "agent" ? agentVoice : resVoice;
    if (u.voice) u.lang = u.voice.lang;
    u.rate = 1.02; u.pitch = line.who === "agent" ? 1.02 : 0.9;
    let fired = false; const go = () => { if (fired) return; fired = true; done(); };
    u.onend = go; u.onerror = go;
    setTimeout(go, line.text.length * 62 + 1700); // safety net
    speechSynthesis.speak(u);
  }
  function killAudio() { if (curAudio) { try { curAudio.pause(); } catch (e) {} curAudio = null; } if ("speechSynthesis" in window) { try { speechSynthesis.cancel(); } catch (e) {} } }

  // ── VISUAL run (muted, auto-loop) ──
  function runVisual() {
    soundBtn.classList.remove("playing");
    if (REDUCED) { showFinished(); return; }
    gen += 1; const my = gen; clearTimers(); killAudio(); reset();
    const tl = [];
    tl.push([320, () => { stage.dataset.step = "1"; markSteps(1); setHed(1, false); cursor.classList.add("on"); zoomTo("await", 1.0, 850); }]);
    tl.push([1300, () => { moveCursor("awaitPill"); }]);
    tl.push([2400, () => { stage.dataset.step = "2"; markSteps(2); setHed(2); cursor.classList.remove("on"); zoomTo("call", 1.0, 850); startTimer(0); }]);
    let t = 3100;
    LINES.forEach((ln, i) => {
      tl.push([t, () => {
        if (i === 9) setHedStr("Thursday doesn't work &mdash; so it finds another date.");
        if (i === 11) { stage.dataset.step = "3"; markSteps(3); setHed(3); }
        revealLine(i); if (ln.cap != null) fillCap(ln.cap);
      }]);
      t += 470;
    });
    const rec = t + 500;
    tl.push([rec, () => { stage.dataset.step = "4"; markSteps(4); setHed(4); stopTimer(); zoomTo("record", 1.0, 850); }]);
    tl.push([rec + 850, () => { zoomTo("recDiary", 1.14); calBlock.classList.add("drop"); }]);
    tl.push([rec + 1700, () => { zoomTo("recLog", 1.12); }]);
    ["1", "2", "3", "4"].forEach((k, i) => tl.push([rec + 1850 + i * 330, () => recLes[k].classList.add("show")]));
    tl.push([rec + 3300, () => recSms.classList.add("show")]);
    tl.push([rec + 3900, () => recChip.classList.add("show")]);
    tl.push([rec + 4500, () => zoomTo("record", 1.0, 850)]);
    const pay = rec + 6200;
    tl.push([pay, () => { stage.dataset.step = "payoff"; markSteps("all"); cursor.classList.remove("on"); zoomTo("payoff", 1.0, 850); }]);
    tl.push([pay + 4200, () => { stage.dataset.step = "0"; }]);
    tl.push([pay + 4500, () => { runVisual(); }]);
    tl.forEach(([ms, fn]) => timers.push(setTimeout(() => { if (my === gen) fn(); }, ms)));
  }

  // ── AUDIO run (the real call, on demand) ──
  async function runAudio() {
    gen += 1; const my = gen; clearTimers(); killAudio(); reset();
    soundBtn.classList.add("playing"); loadVoices();
    const alive = () => my === gen;
    stage.dataset.step = "1"; markSteps(1); setHed(1, false); zoomTo("await", 1.0, 850);
    await sleep(1500); if (!alive()) return;
    stage.dataset.step = "2"; markSteps(2); setHed(2); zoomTo("call", 1.0, 850); startTimer(0);
    await sleep(800); if (!alive()) return;
    for (let i = 0; i < LINES.length; i++) {
      if (!alive()) return;
      if (i === 9) setHedStr("Thursday doesn't work &mdash; so it finds another date.");
      if (i === 11) { stage.dataset.step = "3"; markSteps(3); setHed(3); }
      revealLine(i); txEls[i].classList.add("speaking");
      await speak(i);
      if (!alive()) return;
      txEls[i].classList.remove("speaking");
      if (LINES[i].cap != null) fillCap(LINES[i].cap);
      await sleep(220);
    }
    stopTimer();
    if (!alive()) return;
    stage.dataset.step = "4"; markSteps(4); setHed(4); zoomTo("record", 1.0, 850);
    await sleep(950); if (!alive()) return; zoomTo("recDiary", 1.14); calBlock.classList.add("drop");
    await sleep(950); if (!alive()) return; zoomTo("recLog", 1.12);
    for (const k of ["1", "2", "3", "4"]) { recLes[k].classList.add("show"); await sleep(330); if (!alive()) return; }
    recSms.classList.add("show"); await sleep(650); recChip.classList.add("show");
    await sleep(800); zoomTo("record", 1.0, 850);
    await sleep(1500); if (!alive()) return;
    stage.dataset.step = "payoff"; markSteps("all"); zoomTo("payoff", 1.0, 850);
    await sleep(3200); if (!alive()) return;
    soundBtn.classList.remove("playing");
    runVisual();
  }

  // ── controls ──
  soundBtn.addEventListener("click", () => {
    if (soundBtn.classList.contains("playing")) { runVisual(); }
    else { runAudio(); }
  });
  replayBtn.addEventListener("click", () => { runVisual(); });

  // ── freeze (screenshot verification): ?freeze=1|2|3|4|payoff ──
  function freezeAt(step) {
    gen += 1; clearTimers(); killAudio(); stage.classList.add("measuring"); measure(); reset(); stage.classList.add("frozen"); stage.dataset.step = step; cursor.classList.remove("on");
    const shownLines = step === "2" ? 8 : LINES.length;
    if (step === "2" || step === "3") {
      for (let i = 0; i < shownLines; i++) txEls[i].classList.add("show");
      LINES.slice(0, shownLines).forEach((ln) => { if (ln.cap != null) fillCap(ln.cap); });
      markSteps(step === "2" ? 2 : 3); setHed(step, false); callTimer.textContent = step === "2" ? "00:28" : "01:24";
    }
    if (step === "1") { markSteps(1); setHed(1, false); }
    if (step === "4") { calBlock.classList.add("drop"); Object.values(recLes).forEach((el) => el.classList.add("show")); recSms.classList.add("show"); recChip.classList.add("show"); markSteps(4); setHed(4, false); }
    if (step === "payoff") { markSteps("all"); }
    const roiMap = { "1": "await", "2": "call", "3": "call", "4": "record", "payoff": "payoff" };
    camera.style.transition = "none"; zoomTo(roiMap[step] || "await", 1.0, 0);
  }

  let rT; window.addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(() => { const t = camera.style.transition; camera.style.transition = "none"; measure(); applyCamera(); applyCursor(); requestAnimationFrame(() => { camera.style.transition = t; }); }, 200); });

  let booted = false;
  function boot() {
    if (booted) return; booted = true; measure();
    const fz = new URLSearchParams(location.search).get("freeze");
    if (fz) { freezeAt(fz); return; }
    if (REDUCED) { showFinished(); return; }
    reset(); runVisual();
  }
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(boot); setTimeout(boot, 1200); }
  else { boot(); }
})();
