// Record screen: prompt → record → review → analyse → feedback. Used for baseline, daily exercise and retries.
import { h, render, audioPlayer, toast } from "../lib/ui.js";
import { recorderWidget } from "./recorder-widget.js";
import { analyseRecording, saveSession } from "../lib/pipeline.js";
import { db } from "../lib/db.js";
import { BASELINE, EXERCISES } from "../lib/content.js";

export function resolvePrompt({ kind, exerciseId, parent }) {
  if (parent) return { title: parent.title, prompt: parent.promptText, seconds: parent.targetSeconds || 45, passage: parent.passageText || null, exerciseId: parent.exerciseId, exercise: findExercise(parent.exerciseId) };
  if (kind === "baseline-intro") return { title: BASELINE.intro.title, prompt: BASELINE.intro.prompt, seconds: BASELINE.intro.seconds, passage: null };
  if (kind === "baseline-passage") return { title: BASELINE.passage.title, prompt: BASELINE.passage.prompt, seconds: BASELINE.passage.seconds, passage: BASELINE.passage.text };
  const ex = findExercise(exerciseId);
  if (ex) return { title: ex.title, prompt: ex.prompt, seconds: ex.seconds, passage: null, exerciseId: ex.id, exercise: ex };
  return { title: "Free practice", prompt: "Say anything you would like feedback on. 30 to 60 seconds works best.", seconds: 45, passage: null };
}

function findExercise(id) {
  return Object.values(EXERCISES).flat().find((e) => e.id === id) || null;
}

export async function recordScreen(root, { kind, exerciseId, parentId, navigate, profile, settings, config }) {
  const parent = parentId ? await db.getSession(parentId) : null;
  const spec = resolvePrompt({ kind, exerciseId, parent });
  const sessionKind = parent ? "retry" : kind.startsWith("baseline") ? "baseline" : "exercise";
  const attemptLabel = parent ? `Attempt ${(await countAttempts(parent)) + 1}` : sessionKind === "baseline" ? "Baseline" : "Today's exercise";

  const stage = h("div", { class: "stack" });
  let take = null;
  let widget = null;

  const transcriptNote = config.stt
    ? "When you tap Analyse, this recording is sent once to the transcription service and not stored there."
    : settings.browserRecognition && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
      ? "Transcription will use your browser's speech recognition while you record. Audio is processed by your browser vendor; nothing is sent to our server."
      : "No transcription service is configured. Pauses and timing will be measured from your audio; the transcript will be a labelled demo sample.";

  function showRecorder() {
    widget?.destroy?.();
    widget = recorderWidget({
      maxSeconds: 150,
      targetSeconds: spec.seconds,
      useBrowserRecognition: !config.stt && settings.browserRecognition,
      onDone: (result) => {
        take = result;
        showReview();
      },
    });
    render(stage, widget);
  }

  function showReview() {
    render(
      stage,
      h("div", { class: "card" },
        h("h3", {}, "Your take"),
        h("p", { class: "small muted" }, `${Math.round(take.duration)} seconds. Listen back before analysing; nothing has been saved yet.`),
        audioPlayer(take.blob, "Playback of your take"),
        h("div", { class: "grid-2" },
          h("button", { class: "btn ghost", type: "button", onClick: () => { take = null; showRecorder(); } }, "Record again"),
          h("button", { class: "btn primary", type: "button", "data-testid": "analyse", onClick: analyse }, "Save & analyse")
        ),
        h("p", { class: "tiny" }, transcriptNote)
      )
    );
  }

  async function analyse() {
    const steps = [["audio", "Measuring pauses and levels from the audio"], ["transcript", "Getting a transcript"], ["measures", "Counting pace and filler words"], ["save", "Saving to this device"]];
    const list = h("ul", { class: "progress-steps" }, ...steps.map(([k, t]) => h("li", { "data-step": k }, t)));
    render(stage, h("div", { class: "card" }, h("div", { class: "row" }, h("span", { class: "spinner" }), h("strong", {}, "Analysing…")), list));
    const mark = (k) => {
      let reached = false;
      for (const li of list.children) {
        if (li.dataset.step === k) { li.className = "active"; reached = true; }
        else li.className = reached ? "" : "done";
      }
    };
    try {
      const analysis = await analyseRecording({ blob: take.blob, duration: take.duration, browserText: take.browserText, exercise: spec.exercise, onStep: mark });
      mark("save");
      const session = await saveSession({
        kind: sessionKind,
        title: spec.title,
        promptText: spec.prompt,
        exerciseId: spec.exerciseId,
        parentId: parent ? parent.parentId || parent.id : null,
        blob: take.blob,
        mimeType: take.mimeType,
        duration: take.duration,
        analysis,
        profile,
        extra: { targetSeconds: spec.seconds, passageText: spec.passage },
      });
      toast("Saved on this device");
      navigate(`#/session/${session.id}`);
    } catch (e) {
      console.error(e);
      render(stage, h("div", { class: "notice error" }, h("strong", {}, "Analysis failed"), `${e.message || e}. Your take is still here.`), h("div", { class: "row" }, h("button", { class: "btn", type: "button", onClick: showReview }, "Back to take")));
    }
  }

  showRecorder();

  render(
    root,
    h("div", { class: "row between" }, h("a", { href: parent ? `#/session/${parent.id}` : "#/", class: "btn sm ghost" }, "← Back"), h("span", { class: "badge badge-accent" }, attemptLabel)),
    h("h1", {}, spec.title),
    spec.passage
      ? h("div", { class: "stack" }, h("p", { class: "muted" }, spec.prompt), h("div", { class: "prompt-box passage" }, spec.passage))
      : h("div", { class: "prompt-box" }, spec.prompt),
    parent?.analysis?.tip?.nextStep ? h("div", { class: "notice good" }, h("strong", {}, "Focus for this attempt"), parent.analysis.coach?.nextStep || parent.analysis.tip.nextStep) : null,
    h("div", { class: "card" }, stage)
  );
  return () => widget?.destroy?.();
}

async function countAttempts(parent) {
  const all = await db.listSessions();
  const rootId = parent.parentId || parent.id;
  return all.filter((s) => s.id === rootId || s.parentId === rootId).length;
}
