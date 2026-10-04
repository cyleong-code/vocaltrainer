// Role-play: the partner speaks, you record, we transcribe, the partner responds. Three exchanges, then a debrief.
import { h, render, audioPlayer, badgeFor, toast } from "../lib/ui.js";
import { recorderWidget } from "./recorder-widget.js";
import { analyseRecording, saveSession } from "../lib/pipeline.js";
import { requestRoleplayTurn } from "../lib/api.js";
import { ROLEPLAY } from "../lib/content.js";
import { fmtSec } from "../lib/measures.js";

export async function roleplayScreen(root, { navigate, profile, settings, config }) {
  const state = { history: [], turns: [], finished: false, partnerSource: config.llm ? "AI partner" : "Scripted partner (demo)" };
  const chat = h("div", { class: "chat", "data-testid": "chat" });
  const stage = h("div", { class: "stack" });
  let widget = null;

  const speak = (text) => {
    if (!settings.readAloud || !("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      speechSynthesis.speak(u);
    } catch {}
  };

  const addBubble = (who, text, cls, extra) => {
    chat.append(h("div", { class: `bubble ${cls}` }, h("span", { class: "who" }, who), text, extra || null));
  };

  render(
    root,
    h("h1", {}, "Role-play"),
    h("div", { class: "card" },
      h("div", { class: "row between" }, h("h2", {}, ROLEPLAY.title), h("span", { class: `badge ${config.llm ? "badge-live" : "badge-demo"}` }, state.partnerSource)),
      h("p", { class: "small muted" }, ROLEPLAY.setting),
      config.llm ? null : h("div", { class: "notice demo small" }, h("strong", {}, "Demo partner"), "No AI service is configured, so the partner follows a fixed script and does not react to what you say. Your answers are still recorded, measured and saved."),
      !config.stt ? h("p", { class: "tiny" }, "Without a transcription service your answers cannot be read by the partner; the browser's speech recognition is used when available, otherwise a labelled demo transcript stands in.") : null,
      h("details", {}, h("summary", { class: "small" }, "Tips"), h("ul", { class: "small muted" }, ...ROLEPLAY.tips.map((t) => h("li", {}, t))))
    ),
    h("div", { class: "card" }, chat),
    h("div", { class: "card" }, stage)
  );

  addBubble("Dana", ROLEPLAY.opening, "partner", h("button", { class: "btn sm ghost", type: "button", style: "margin-top:6px", onClick: () => speak(ROLEPLAY.opening) }, "Read aloud"));
  state.history.push({ role: "partner", text: ROLEPLAY.opening });

  function showRecorder() {
    widget?.destroy?.();
    const turnNo = state.turns.length + 1;
    widget = recorderWidget({
      maxSeconds: 90,
      targetSeconds: 30,
      useBrowserRecognition: !config.stt && settings.browserRecognition,
      onDone: (take) => showReview(take, turnNo),
    });
    render(stage, h("p", { class: "small muted", style: "text-align:center" }, `Your answer ${turnNo} of ${ROLEPLAY.turns}`), widget);
  }

  function showReview(take, turnNo) {
    render(
      stage,
      h("p", { class: "small muted" }, "Listen back, then send your answer to Dana."),
      audioPlayer(take.blob, "Your answer"),
      h("div", { class: "grid-2" },
        h("button", { class: "btn ghost", type: "button", onClick: showRecorder }, "Re-record"),
        h("button", { class: "btn primary", type: "button", "data-testid": "send-answer", onClick: () => sendAnswer(take, turnNo) }, "Send answer")
      )
    );
  }

  async function sendAnswer(take, turnNo) {
    render(stage, h("div", { class: "row" }, h("span", { class: "spinner" }), h("span", {}, "Transcribing your answer…")));
    let analysis;
    try {
      analysis = await analyseRecording({ blob: take.blob, duration: take.duration, browserText: take.browserText });
    } catch (e) {
      render(stage, h("div", { class: "notice error" }, `Could not analyse the answer: ${e.message}`), h("button", { class: "btn", type: "button", onClick: showRecorder }, "Try again"));
      return;
    }
    const session = await saveSession({ kind: "roleplay", title: `Role-play answer ${turnNo}`, promptText: state.history[state.history.length - 1].text, blob: take.blob, mimeType: take.mimeType, duration: take.duration, analysis, profile });
    state.turns.push(session);

    if (!analysis.audio?.usable) {
      addBubble("You", "(no speech detected)", "me", h("div", { class: "tiny" }, "Nothing was heard. Check your microphone and answer again."));
      showRecorder();
      return;
    }
    const t = analysis.transcript;
    const label = t.real ? "" : " (demo transcript, not your words)";
    addBubble("You", t.text, "me", h("div", { class: "tiny", style: "margin-top:4px" }, badgeFor(t), ` ${analysis.measures.wpm ?? "–"} wpm · ${analysis.measures.fillerCount} fillers · ${analysis.measures.pauseCount} pauses${label}`));
    state.history.push({ role: "user", text: t.text });

    render(stage, h("div", { class: "row" }, h("span", { class: "spinner" }), h("span", {}, "Dana is replying…")));
    try {
      const turn = await requestRoleplayTurn({ scenarioId: ROLEPLAY.id, history: state.history.slice(1) });
      addBubble("Dana", turn.reply, "partner", h("div", { class: "tiny", style: "margin-top:4px" }, turn.sourceLabel));
      state.history.push({ role: "partner", text: turn.reply });
      speak(turn.reply);
      if (turn.finished || state.turns.length >= ROLEPLAY.turns) {
        state.finished = true;
        showDebrief();
      } else {
        showRecorder();
      }
    } catch (e) {
      render(stage, h("div", { class: "notice error" }, "The partner did not respond. Your answer was saved."), h("button", { class: "btn", type: "button", onClick: () => sendAnswerRetry() }, "Retry reply"));
    }
  }

  async function sendAnswerRetry() {
    render(stage, h("div", { class: "row" }, h("span", { class: "spinner" }), h("span", {}, "Dana is replying…")));
    try {
      const turn = await requestRoleplayTurn({ scenarioId: ROLEPLAY.id, history: state.history.slice(1) });
      addBubble("Dana", turn.reply, "partner", h("div", { class: "tiny" }, turn.sourceLabel));
      state.history.push({ role: "partner", text: turn.reply });
      if (turn.finished || state.turns.length >= ROLEPLAY.turns) showDebrief();
      else showRecorder();
    } catch {
      render(stage, h("div", { class: "notice error" }, "Still no reply. Check the server is running."), h("button", { class: "btn", type: "button", onClick: sendAnswerRetry }, "Retry"));
    }
  }

  function showDebrief() {
    const real = state.turns.every((s) => s.analysis.transcript?.real);
    render(
      stage,
      h("h3", {}, "Debrief"),
      real ? null : h("p", { class: "tiny" }, "Pace and filler figures marked demo describe sample text, not your words."),
      h("table", { class: "compare" },
        h("thead", {}, h("tr", {}, h("th", {}, "Answer"), h("th", {}, "wpm"), h("th", {}, "fillers"), h("th", {}, "pauses"), h("th", {}, "time"))),
        h("tbody", {}, ...state.turns.map((s, i) => {
          const m = s.analysis.measures;
          const demo = !s.analysis.transcript?.real;
          return h("tr", {}, h("td", {}, h("a", { href: `#/session/${s.id}` }, `Answer ${i + 1}`)), h("td", {}, m.wpm ?? "–", demo ? "*" : ""), h("td", {}, m.fillerCount, demo ? "*" : ""), h("td", {}, m.pauseCount), h("td", {}, fmtSec(m.speakingSpan)));
        }))
      ),
      real ? null : h("p", { class: "tiny" }, "* from a demo transcript"),
      h("p", { class: "small muted" }, "Each answer is saved as its own recording with full feedback. Tap an answer to see it."),
      h("div", { class: "grid-2" }, h("button", { class: "btn primary", type: "button", onClick: () => roleplayScreen(root, { navigate, profile, settings, config }) }, "Run it again"), h("a", { class: "btn ghost", href: "#/progress" }, "Progress"))
    );
    toast("Role-play saved");
  }

  showRecorder();
  return () => { widget?.destroy?.(); try { speechSynthesis?.cancel(); } catch {} };
}
