// Router and shell. Screens live in /screens; shared logic in /lib.
import { h, render, toast, badgeFor, fmtDate } from "./lib/ui.js";
import { db } from "./lib/db.js";
import { getConfig } from "./lib/api.js";
import { GOALS, SITUATIONS, BASELINE, pickDailyExercise, goalById, situationById } from "./lib/content.js";
import { browserRecognitionSupported } from "./lib/recorder.js";
import { recordScreen } from "./screens/record.js";
import { sessionScreen, compareScreen } from "./screens/feedback.js";
import { progressScreen } from "./screens/progress.js";
import { roleplayScreen } from "./screens/roleplay.js";

const main = document.getElementById("main");
const DEFAULT_SETTINGS = { browserRecognition: true, readAloud: true };
let cleanup = null;
let routeSeq = 0;

function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

async function loadState() {
  const [profile, settings, config] = await Promise.all([db.getSetting("profile"), db.getSetting("settings", DEFAULT_SETTINGS), getConfig()]);
  return { profile, settings: { ...DEFAULT_SETTINGS, ...(settings || {}) }, config };
}

function setTab(name) {
  document.querySelectorAll(".tabbar a").forEach((a) => a.classList.toggle("active", a.dataset.tab === name));
}

function serviceBadge(config) {
  const el = document.getElementById("service-badge");
  if (config.offline) { el.className = "badge badge-warn"; el.textContent = "Server offline"; return; }
  if (config.stt && config.llm) { el.className = "badge badge-live"; el.textContent = "Live services"; }
  else if (config.stt || config.llm) { el.className = "badge badge-warn"; el.textContent = config.stt ? "Transcription live · AI demo" : "AI live · transcription demo"; }
  else { el.className = "badge badge-demo"; el.textContent = "Demo mode"; }
  el.title = `Speech-to-text: ${config.stt ? "configured" : "not configured"} · AI coach: ${config.llm ? "configured" : "not configured"}`;
}

async function route() {
  if (typeof cleanup === "function") { try { cleanup(); } catch {} cleanup = null; }
  const seq = ++routeSeq;
  const state = await loadState();
  if (seq !== routeSeq) return; // a newer navigation happened while loading
  serviceBadge(state.config);
  const [path, query] = (location.hash.slice(1) || "/").split("?");
  const params = new URLSearchParams(query || "");
  const seg = path.split("/").filter(Boolean);
  const ctx = { ...state, navigate };

  try {
    if (!seg.length) { setTab("home"); return state.profile ? homeScreen(main, ctx) : onboardingScreen(main, ctx); }
    switch (seg[0]) {
      case "onboarding": setTab("home"); return onboardingScreen(main, ctx);
      case "baseline": setTab("home"); return baselineScreen(main, ctx);
      case "record": setTab("home"); cleanup = await recordScreen(main, { ...ctx, kind: seg[1] || "free", exerciseId: params.get("exercise"), parentId: params.get("parent") }); return;
      case "session": setTab("progress"); return sessionScreen(main, { ...ctx, id: seg[1] });
      case "compare": setTab("progress"); return compareScreen(main, { ...ctx, aId: seg[1], bId: seg[2] });
      case "progress": setTab("progress"); return progressScreen(main, ctx);
      case "roleplay": setTab("roleplay"); cleanup = await roleplayScreen(main, ctx); return;
      case "settings": setTab("settings"); return settingsScreen(main, ctx);
      default: return navigate("#/");
    }
  } catch (e) {
    console.error(e);
    render(main, h("div", { class: "notice error" }, h("strong", {}, "Something went wrong"), String(e.message || e)), h("a", { class: "btn", href: "#/" }, "Home"));
  }
}

// ---------- Onboarding ----------
function onboardingScreen(root, { profile, navigate }) {
  const draft = { goal: profile?.goal || null, situation: profile?.situation || null };
  let step = 0;
  const steps = h("div", { class: "steps" }, h("span", { class: "on" }), h("span"), h("span"));
  const body = h("div", { class: "stack" });

  const choiceList = (items, key, next) => h("div", { class: "stack", role: "group" }, ...items.map((it) =>
    h("button", { class: "choice", type: "button", "aria-pressed": String(draft[key] === it.id), "data-testid": `${key}-${it.id}`, onClick: () => { draft[key] = it.id; next(); } }, h("strong", {}, it.title), h("span", {}, it.blurb))
  ));

  function show() {
    [...steps.children].forEach((s, i) => s.classList.toggle("on", i <= step));
    if (step === 0) {
      render(body, h("h1", {}, "What do you want to get better at?"), h("p", { class: "muted" }, "Pick one. You can change it later."), choiceList(GOALS, "goal", () => { step = 1; show(); }));
    } else if (step === 1) {
      render(body, h("h1", {}, "Where will you use it?"), h("p", { class: "muted" }, "Exercises are framed around this situation."), choiceList(SITUATIONS, "situation", () => { step = 2; show(); }), h("button", { class: "btn ghost", type: "button", onClick: () => { step = 0; show(); } }, "Back"));
    } else {
      render(body,
        h("h1", {}, "How this works"),
        h("div", { class: "card soft stack" },
          h("p", {}, h("strong", {}, "1. Record a baseline."), " A 45-second introduction or a short read-aloud, saved for later comparison."),
          h("p", {}, h("strong", {}, "2. Get feedback you can check."), " Pace, pauses and filler words, each labelled with where the number came from, with quotes from your transcript."),
          h("p", {}, h("strong", {}, "3. Try again and compare."), " Play both attempts back to back and see what changed.")
        ),
        h("div", { class: "notice good small" }, h("strong", {}, "Private by default"), "Recordings stay in this browser. Nothing is uploaded unless you choose to analyse with a configured transcription service, and you can delete any recording at any time."),
        h("div", { class: "notice small", style: "background:var(--surface-2)" }, "Accents are not measured or judged. The app looks at delivery choices such as pace and pauses, not at how you pronounce words."),
        h("button", { class: "btn primary block", type: "button", "data-testid": "finish-onboarding", onClick: async () => {
          const g = goalById(draft.goal), s = situationById(draft.situation);
          await db.setSetting("profile", { goal: g.id, goalTitle: g.title, situation: s.id, situationTitle: s.title, createdAt: profile?.createdAt || Date.now() });
          toast("Saved");
          navigate("#/");
        } }, "Start with a baseline"),
        h("button", { class: "btn ghost block", type: "button", onClick: () => { step = 1; show(); } }, "Back")
      );
    }
  }
  show();
  render(root, steps, body);
}

// ---------- Home ----------
async function homeScreen(root, { profile, navigate, config }) {
  const sessions = await db.listSessions();
  const baseline = sessions.filter((s) => s.kind === "baseline");
  const lastReal = [...sessions].reverse().find((s) => s.analysis?.transcript?.real)?.analysis?.measures || null;
  const exercise = pickDailyExercise(profile.goal, lastReal);
  const todayDone = sessions.find((s) => s.exerciseId === exercise.id && new Date(s.createdAt).toDateString() === new Date().toDateString());
  const recent = [...sessions].reverse().slice(0, 3);

  render(
    root,
    h("div", { class: "row between" }, h("div", {}, h("p", { class: "tiny", style: "margin:0" }, `${profile.goalTitle} · ${profile.situationTitle}`), h("h1", {}, "Practise")), h("a", { class: "btn sm ghost", href: "#/onboarding" }, "Change goal")),

    !baseline.length
      ? h("div", { class: "card" }, h("span", { class: "badge badge-accent" }, "Step 1"), h("h2", { style: "margin-top:8px" }, "Record your baseline"), h("p", { class: "muted" }, "A first recording to measure everything else against. About a minute."), h("a", { class: "btn primary block", href: "#/baseline", "data-testid": "start-baseline" }, "Start baseline"))
      : h("div", { class: "card" },
          h("div", { class: "row between" }, h("h2", {}, "Today's exercise"), todayDone ? h("span", { class: "badge badge-live" }, "Done today") : h("span", { class: "badge badge-muted" }, `~${exercise.seconds}s`)),
          h("h3", {}, exercise.title),
          h("div", { class: "prompt-box" }, exercise.prompt),
          lastReal && exercise.id.startsWith("fill") && profile.goal !== "fillers" ? h("p", { class: "tiny" }, "Chosen because your last transcript showed several filler words per minute.") : null,
          lastReal && exercise.id.startsWith("pace") && profile.goal !== "pace" ? h("p", { class: "tiny" }, "Chosen because your last measured pace was above 175 words per minute.") : null,
          h("a", { class: "btn primary block", href: `#/record/exercise?exercise=${exercise.id}`, "data-testid": "start-exercise", style: "margin-top:10px" }, todayDone ? "Do it again" : "Record"),
          todayDone ? h("a", { class: "btn ghost block", href: `#/session/${todayDone.id}`, style: "margin-top:8px" }, "See today's feedback") : null
        ),

    baseline.length ? h("div", { class: "card soft" }, h("div", { class: "row between" }, h("div", {}, h("h3", {}, "Baseline"), h("p", { class: "tiny", style: "margin:0" }, `${baseline.length} recorded · first on ${fmtDate(baseline[0].createdAt)}`)), h("a", { class: "btn sm", href: `#/session/${baseline[baseline.length - 1].id}` }, "Open")), h("a", { class: "btn sm ghost", href: "#/baseline", style: "margin-top:8px" }, "Record another baseline")) : null,

    recent.length ? h("div", { class: "card" }, h("h3", {}, "Recent"), ...recent.map((s) => h("a", { href: `#/session/${s.id}`, class: "session-item", style: "text-decoration:none;color:inherit" }, h("div", { class: "meta" }, h("div", { class: "title" }, s.title, s.attempt > 1 ? ` · attempt ${s.attempt}` : ""), h("div", { class: "stats" }, fmtDate(s.createdAt))), badgeFor(s.analysis?.transcript))), h("a", { class: "btn sm ghost", href: "#/progress" }, "All recordings")) : null,

    h("div", { class: "card soft" }, h("h3", {}, "Role-play"), h("p", { class: "small muted" }, "A stakeholder asks why the launch slipped. Three exchanges, then a debrief."), h("a", { class: "btn block", href: "#/roleplay" }, config.llm ? "Start role-play" : "Start role-play (scripted demo)")),
    isIosSafariTab() ? h("div", { class: "notice small", style: "background:var(--surface-2)" }, h("strong", {}, "Use it like an app"), "Tap the Share button in Safari, then “Add to Home Screen”. Open it from there so your recordings are kept long-term.") : null,
    !config.stt ? h("p", { class: "tiny" }, "Demo mode: no transcription service is configured. Pauses and timing are real; transcripts come from your browser's speech recognition where supported, otherwise a labelled sample. See Settings.") : null
  );
}

function baselineScreen(root) {
  render(
    root,
    h("a", { href: "#/", class: "btn sm ghost" }, "← Back"),
    h("h1", {}, "Baseline"),
    h("p", { class: "muted" }, "Choose one. Both are fine; the read-aloud passage is easier if you would rather not improvise."),
    h("a", { class: "card", href: "#/record/baseline-intro", style: "display:block;text-decoration:none;color:inherit", "data-testid": "baseline-intro" }, h("h2", {}, BASELINE.intro.title), h("p", { class: "small muted" }, BASELINE.intro.prompt)),
    h("a", { class: "card", href: "#/record/baseline-passage", style: "display:block;text-decoration:none;color:inherit", "data-testid": "baseline-passage" }, h("h2", {}, BASELINE.passage.title), h("p", { class: "small muted" }, "About 90 words. Read at your meeting pace."))
  );
}

// ---------- Settings ----------
async function settingsScreen(root, { settings, config, profile, navigate }) {
  const save = async (patch) => { await db.setSetting("settings", { ...settings, ...patch }); toast("Saved"); route(); };
  const toggle = (label, desc, key, disabled) => h("label", { class: "choice row between", style: disabled ? "opacity:.6" : "" }, h("span", {}, h("strong", {}, label), h("span", {}, desc)), h("input", { type: "checkbox", checked: settings[key] ? true : null, disabled: disabled || null, onChange: (e) => save({ [key]: e.target.checked }), style: "width:22px;height:22px" }));
  const theme = document.documentElement.dataset.theme || "auto";
  render(
    root,
    h("h1", {}, "Settings"),
    h("div", { class: "card" },
      h("h2", {}, "Services"),
      h("p", { class: "small muted" }, "Set on the server through environment variables. The app tells you on every result which one produced it."),
      serviceRow("Speech-to-text", config.stt, "OpenAI Whisper, used only when you tap Analyse.", "Not configured: transcripts come from your browser's speech recognition where available, otherwise a labelled demo sample. Pauses and timing are always measured from the real audio."),
      serviceRow("AI coach and role-play partner", config.llm, "Anthropic Claude writes the coaching note and plays the role-play partner, from the transcript and measures only.", "Not configured: tips are rule-based from the measures, and the role-play partner follows a fixed script.")
    ),
    h("div", { class: "card stack" },
      h("h2", {}, "Transcription"),
      toggle("Use browser speech recognition", browserRecognitionSupported() ? "When no server transcription is configured. Your browser vendor processes the audio." : "Not supported in this browser.", "browserRecognition", !browserRecognitionSupported()),
      toggle("Read the role-play partner aloud", "Uses your device's built-in voice.", "readAloud", !("speechSynthesis" in window))
    ),
    h("div", { class: "card stack" },
      h("h2", {}, "Appearance"),
      h("div", { class: "row" }, ...["auto", "light", "dark"].map((t) => h("button", { class: `btn sm ${theme === t ? "primary" : "ghost"}`, type: "button", onClick: () => { if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; try { localStorage.setItem("theme", t); } catch {} route(); } }, t[0].toUpperCase() + t.slice(1))))
    ),
    h("div", { class: "card stack" },
      h("h2", {}, "Privacy"),
      h("p", { class: "small" }, "Recordings and feedback are stored in this browser only (IndexedDB). They are not uploaded anywhere unless you analyse a take while a transcription service is configured, in which case the audio is sent once for transcription and not kept by this app's server."),
      h("p", { class: "small" }, "The app does not measure or judge accent or pronunciation. Measures are limited to timing, pauses, pace and the words in the transcript."),
      profile ? h("a", { class: "btn ghost block", href: "#/onboarding" }, "Change goal or situation") : null,
      h("a", { class: "btn danger block", href: "#/progress" }, "Manage or delete recordings")
    ),
    h("p", { class: "tiny" }, "SpeakWell MVP. Not a clinical or assessment tool.")
  );
}

function serviceRow(name, on, onText, offText) {
  return h("div", { class: "row between", style: "padding:10px 0;border-top:1px solid var(--line)" }, h("div", { style: "flex:1" }, h("strong", {}, name), h("p", { class: "tiny", style: "margin:2px 0 0" }, on ? onText : offText)), h("span", { class: `badge ${on ? "badge-live" : "badge-demo"}` }, on ? "Live" : "Demo"));
}

function isIosSafariTab() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad/.test(ua);
  const standalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  return ios && !standalone;
}

// ---------- boot ----------
try {
  const t = localStorage.getItem("theme");
  if (t && t !== "auto") document.documentElement.dataset.theme = t;
} catch {}
window.addEventListener("hashchange", route);
route();
