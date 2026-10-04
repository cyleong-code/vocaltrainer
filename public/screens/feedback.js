// Feedback screen for one session, and the side-by-side comparison of two attempts.
import { h, render, audioPlayer, badgeFor, fmtDate, toast, confirmDialog } from "../lib/ui.js";
import { db } from "../lib/db.js";
import { fmtSec, compareAttempts, contextToString } from "../lib/measures.js";
import { fetchCoachNote } from "../lib/pipeline.js";

export async function sessionScreen(root, { id, navigate, config }) {
  const session = await db.getSession(id);
  if (!session) {
    render(root, h("div", { class: "card" }, h("h2", {}, "Recording not found"), h("p", {}, "It may have been deleted."), h("a", { class: "btn", href: "#/progress" }, "Go to progress")));
    return;
  }
  const all = await db.listSessions();
  const rootId = session.parentId || session.id;
  const chain = all.filter((s) => s.id === rootId || s.parentId === rootId).sort((a, b) => a.createdAt - b.createdAt);
  const idx = chain.findIndex((s) => s.id === session.id);
  const previous = idx > 0 ? chain[idx - 1] : null;
  const next = idx < chain.length - 1 ? chain[idx + 1] : null;
  const a = session.analysis || {};
  const m = a.measures;
  const t = a.transcript;
  const demo = t && !t.real;

  const measureCard = (val, lbl, src, cls = "") => h("div", { class: `measure ${cls}` }, h("div", { class: "val" }, val ?? "–"), h("div", { class: "lbl" }, lbl), h("div", { class: "src" }, src));

  const tipBox = h("div", { class: "stack", "data-testid": "tip" });
  renderTip(tipBox, a.coach || a.tip, Boolean(a.coach));

  render(
    root,
    h("div", { class: "row between" }, h("a", { href: session.kind === "roleplay" ? "#/roleplay" : "#/", class: "btn sm ghost" }, "← Home"), h("span", { class: "badge badge-accent" }, chain.length > 1 ? `Attempt ${idx + 1} of ${chain.length}` : kindLabel(session.kind))),
    h("h1", {}, session.title),
    h("p", { class: "small muted" }, `${fmtDate(session.createdAt)} · ${Math.round(session.duration)}s · stored only on this device`),
    h("div", { class: "card" }, h("h3", {}, "Playback"), audioPlayer(session.audio, "Playback of this recording"), h("details", {}, h("summary", { class: "small" }, "Prompt"), h("p", { class: "small muted" }, session.promptText))),

    a.audio?.quality?.length ? h("div", { class: "stack" }, ...a.audio.quality.map((q) => h("div", { class: `notice ${q.code === "silent" ? "error" : "warn"}` }, q.text))) : null,
    a.notes?.length ? h("div", { class: "notice warn small" }, ...a.notes.map((n) => h("div", {}, n))) : null,

    !a.audio?.usable
      ? h("div", { class: "card" }, h("h2", {}, "Nothing to measure yet"), h("p", {}, "No usable speech was detected in this recording, so there are no pace or filler measures. Pauses need speech on both sides to count."), retryButton(session, navigate))
      : h("div", { class: "card" },
          h("div", { class: "row between" }, h("h2", {}, "What was measured"), badgeFor(t)),
          demo ? h("div", { class: "notice demo small" }, h("strong", {}, "Demo transcript in use"), "Pace and filler counts describe the sample text, not your words. Pauses and speaking time are measured from your real audio.") : null,
          h("div", { class: "measures" },
            measureCard(m.wpm, "words per minute", demo ? "needs a real transcript" : "from transcript + audio timing", demo ? "demo" : ""),
            measureCard(m.fillerCount, `filler word${m.fillerCount === 1 ? "" : "s"}${m.fillersPerMin != null ? ` (${m.fillersPerMin}/min)` : ""}`, demo ? "from demo transcript" : t?.source === "browser" ? "from browser transcript (may miss some)" : "from transcript", demo ? "demo" : ""),
            measureCard(m.pauseCount, `audible pause${m.pauseCount === 1 ? "" : "s"} (≥0.6s)`, "from your audio"),
            measureCard(m.longestPause?.duration ? `${m.longestPause.duration}s` : "–", m.longestPause?.duration ? `longest pause, at ${fmtSec(m.longestPause.at)}` : "longest pause", "from your audio"),
            measureCard(fmtSec(m.speakingSpan), "speaking time", "from your audio"),
            measureCard(m.words, "words", demo ? "from demo transcript" : "from transcript", demo ? "demo" : "")
          ),
          m.wpm != null ? h("p", { class: "tiny", style: "margin-top:10px" }, paceContext(m)) : null
        ),

    a.audio?.usable && t
      ? h("div", { class: "card" },
          h("div", { class: "row between" }, h("h2", {}, demo ? "Demo transcript" : "Transcript"), badgeFor(t)),
          h("p", { class: "tiny" }, t.sourceLabel),
          h("div", { class: "transcript", "data-testid": "transcript" }, ...highlightFillers(t.text, m.fillers)),
          examplesBlock(m, demo)
        )
      : null,

    a.audio?.usable ? h("div", { class: "card" }, h("h2", {}, "One thing to try next"), tipBox) : null,

    h("div", { class: "card" },
      h("div", { class: "grid-2" },
        retryButton(session, navigate),
        previous ? h("a", { class: "btn", href: `#/compare/${previous.id}/${session.id}`, "data-testid": "compare" }, "Compare with previous") : next ? h("a", { class: "btn", href: `#/compare/${session.id}/${next.id}` }, "Compare with next") : h("a", { class: "btn ghost", href: "#/progress" }, "See progress")
      ),
      h("p", { class: "tiny", style: "margin:12px 0 6px" }, "This recording is private to this browser. Deleting removes the audio and its analysis permanently."),
      h("button", { class: "btn danger block", type: "button", "data-testid": "delete", onClick: async () => {
        if (!(await confirmDialog("Delete this recording and its feedback? This cannot be undone."))) return;
        await db.deleteSession(session.id);
        toast("Recording deleted");
        navigate("#/progress");
      } }, "Delete this recording")
    )
  );

  // AI note arrives after the measures are already visible; the rule-based tip stays if it fails.
  if (config.llm && !a.coach && a.audio?.usable && t) {
    const loading = h("p", { class: "tiny" }, h("span", { class: "spinner" }), " Asking the AI coach for a note on this transcript…");
    tipBox.append(loading);
    try {
      const coach = await fetchCoachNote(session, previous);
      loading.remove();
      if (coach?.nextStep) {
        session.analysis.coach = coach;
        await db.saveSession(session);
        renderTip(tipBox, coach, true, a.tip);
      }
    } catch {
      loading.textContent = "The AI coach did not respond. The rule-based tip above is shown instead.";
    }
  }
}

function retryButton(session, navigate) {
  return h("button", { class: "btn primary", type: "button", "data-testid": "retry", onClick: () => navigate(`#/record/retry?parent=${session.id}`) }, "Try again");
}

function kindLabel(kind) {
  return { baseline: "Baseline", exercise: "Exercise", retry: "Retry", roleplay: "Role-play" }[kind] || "Recording";
}

function paceContext(m) {
  const base = "For reference, many English-language presentations fall between roughly 115 and 170 words per minute. That is a range, not a target; the right pace depends on the listener, the content and your own speaking style.";
  if (m.paceBand === "faster") return `Your measured pace is above that range. ${base}`;
  if (m.paceBand === "slower") return `Your measured pace is below that range. ${base}`;
  return base;
}

function renderTip(box, tip, isAi, fallback) {
  box.replaceChildren();
  if (!tip) return;
  box.append(...[
    h("span", { class: `badge ${isAi ? "badge-live" : "badge-muted"}` }, isAi ? "AI coaching note" : "Rule-based tip"),
    tip.observation ? h("p", {}, tip.observation) : null,
    tip.quote ? h("div", { class: "quote" }, `“${tip.quote}”`) : null,
    h("p", {}, h("strong", {}, "Next attempt: "), tip.nextStep),
    h("p", { class: "tiny" }, tip.sourceLabel),
    isAi && fallback ? h("details", {}, h("summary", { class: "tiny" }, "Rule-based tip"), h("p", { class: "small muted" }, fallback.nextStep)) : null,
  ].filter(Boolean));
}

function examplesBlock(m, demo) {
  const items = [];
  for (const f of m.fillers.slice(0, 5)) items.push(h("div", { class: "quote" }, f.context.before, " ", h("mark", {}, f.context.hit), " ", f.context.after));
  for (const r of m.repeats.slice(0, 2)) items.push(h("div", { class: "quote" }, r.context.before, " ", h("mark", {}, r.context.hit), " ", r.context.after, h("span", { class: "tiny" }, " (repeated word)")));
  if (!items.length) return h("p", { class: "small muted", style: "margin-top:10px" }, demo ? "No filler words in the demo sample." : "No filler words or repeated words were found in the transcript.");
  return h("div", { style: "margin-top:12px" }, h("h3", {}, demo ? "Examples from the demo transcript" : "Examples from your transcript"), ...items, m.fillers.length > 5 ? h("p", { class: "tiny" }, `${m.fillers.length - 5} more highlighted above.`) : null);
}

// Wrap each filler hit in <mark> so the user can see exactly where the count came from.
// Token positions line up with measures.tokenize(), which keeps letters, digits and apostrophes.
function highlightFillers(text, fillers) {
  if (!fillers?.length) return [text];
  const spans = [];
  const tokenRe = /[\p{L}\p{N}']+/gu;
  let match;
  while ((match = tokenRe.exec(text))) spans.push([match.index, match.index + match[0].length]);
  const marks = fillers
    .map((f) => {
      const len = f.word.split(" ").length;
      const first = spans[f.index];
      const last = spans[f.index + len - 1];
      return first && last ? [first[0], last[1]] : null;
    })
    .filter(Boolean)
    .sort((a, b) => a[0] - b[0]);
  const parts = [];
  let i = 0;
  for (const [s, e] of marks) {
    if (s < i) continue;
    if (s > i) parts.push(text.slice(i, s));
    parts.push(h("mark", {}, text.slice(s, e)));
    i = e;
  }
  parts.push(text.slice(i));
  return parts;
}

export async function compareScreen(root, { aId, bId }) {
  const [A, B] = await Promise.all([db.getSession(aId), db.getSession(bId)]);
  if (!A || !B) {
    render(root, h("div", { class: "card" }, h("h2", {}, "One of these recordings is missing"), h("a", { class: "btn", href: "#/progress" }, "Go to progress")));
    return;
  }
  const rows = compareAttempts(A.analysis.measures, B.analysis.measures);
  const bothReal = A.analysis.transcript?.real && B.analysis.transcript?.real;
  const anyDemo = (A.analysis.transcript && !A.analysis.transcript.real) || (B.analysis.transcript && !B.analysis.transcript.real);
  const lowerIsCloser = new Set(["fillerCount", "fillersPerMin", "longestPause"]);

  render(
    root,
    h("div", { class: "row between" }, h("a", { href: `#/session/${B.id}`, class: "btn sm ghost" }, "← Back")),
    h("h1", {}, "Compare attempts"),
    h("p", { class: "muted small" }, A.title),
    h("div", { class: "grid-2" },
      h("div", { class: "card" }, h("h3", {}, "Earlier"), h("p", { class: "tiny" }, fmtDate(A.createdAt)), audioPlayer(A.audio, "Earlier attempt"), badgeFor(A.analysis.transcript)),
      h("div", { class: "card" }, h("h3", {}, "Later"), h("p", { class: "tiny" }, fmtDate(B.createdAt)), audioPlayer(B.audio, "Later attempt"), badgeFor(B.analysis.transcript))
    ),
    anyDemo ? h("div", { class: "notice demo small" }, "At least one attempt uses a demo transcript, so pace and filler rows are not a real comparison. Pause and timing rows are measured from the audio in both.") : null,
    h("div", { class: "card" },
      h("h2", {}, "Side by side"),
      h("table", { class: "compare", "data-testid": "compare-table" },
        h("thead", {}, h("tr", {}, h("th", {}, "Measure"), h("th", {}, "Earlier"), h("th", {}, "Later"), h("th", {}, "Change"))),
        h("tbody", {}, ...rows.map((r) => {
          const transcriptRow = ["wpm", "fillerCount", "fillersPerMin", "words"].includes(r.key);
          const faded = transcriptRow && !bothReal;
          const cls = r.delta == null || r.delta === 0 ? "" : lowerIsCloser.has(r.key) ? (r.delta < 0 ? "down" : "up") : "";
          return h("tr", { style: faded ? "opacity:.55" : "" }, h("td", {}, r.label), h("td", {}, fmt(r.a, r.unit)), h("td", {}, fmt(r.b, r.unit)), h("td", { class: `delta ${cls}` }, r.delta == null ? "–" : (r.delta > 0 ? "+" : "") + r.delta + r.unit));
        }))
      ),
      h("p", { class: "tiny", style: "margin-top:8px" }, "Green marks fewer fillers or a shorter longest pause. Pace and pause counts are shown without a verdict: whether a change helped depends on what you were going for.")
    ),
    h("div", { class: "card" },
      h("h2", {}, "What you were working on"),
      h("p", { class: "small" }, h("strong", {}, "After the earlier attempt: "), A.analysis.coach?.nextStep || A.analysis.tip?.nextStep || "–"),
      h("p", { class: "small" }, h("strong", {}, "After the later attempt: "), B.analysis.coach?.nextStep || B.analysis.tip?.nextStep || "–")
    ),
    h("div", { class: "grid-2" }, h("a", { class: "btn primary", href: `#/record/retry?parent=${B.parentId || B.id}` }, "Try again"), h("a", { class: "btn ghost", href: "#/progress" }, "All sessions"))
  );
}

function fmt(v, unit) {
  return v == null ? "–" : `${v}${unit}`;
}
