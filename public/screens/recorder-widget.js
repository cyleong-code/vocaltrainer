// Reusable recording control with explicit states and plain-language permission help.
import { h, fmtClock } from "../lib/ui.js";
import { Recorder, recordingSupported, browserRecognitionSupported, BrowserRecognizer } from "../lib/recorder.js";

const DENIED_HELP = {
  default: "Microphone access was blocked. Open your browser's site settings for this page, allow the microphone, then reload.",
  ios: "On iPhone: Settings → Safari → Microphone → Allow, or tap the “AA” menu in the address bar → Website Settings → Microphone.",
  android: "On Android Chrome: tap the lock icon in the address bar → Permissions → Microphone → Allow, then reload.",
};

function deniedHelp() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return DENIED_HELP.ios;
  if (/Android/.test(ua)) return DENIED_HELP.android;
  return DENIED_HELP.default;
}

export function recorderWidget({ maxSeconds = 120, targetSeconds, useBrowserRecognition = false, upload = false, onDone }) {
  if (upload) return uploadWidget({ targetSeconds, onDone });
  const root = h("div", { class: "recorder", "data-testid": "recorder" });
  const stateEl = h("div", { class: "rec-state", "data-testid": "rec-state" }, "Ready to record");
  const timerEl = h("div", { class: "rec-timer", "aria-live": "off" }, "00:00");
  const meterBar = h("div");
  const meter = h("div", { class: "meter", "aria-hidden": "true" }, meterBar);
  const icon = h("span", { class: "rec-icon" });
  const btn = h("button", { class: "rec-btn", type: "button", "aria-label": "Start recording", "data-testid": "rec-button" }, icon);
  const hint = h("p", { class: "tiny" }, targetSeconds ? `Aim for about ${targetSeconds} seconds. Recording stops automatically at ${fmtClock(maxSeconds)}.` : `Recording stops automatically at ${fmtClock(maxSeconds)}.`);
  const notice = h("div", { class: "notice error", hidden: true, role: "alert" });
  root.append(stateEl, timerEl, btn, meter, hint, notice);

  if (!recordingSupported()) {
    btn.disabled = true;
    stateEl.textContent = "Recording not supported";
    notice.hidden = false;
    notice.innerHTML = "<strong>This browser cannot record audio.</strong> Try the latest Chrome, Safari or Edge. On iPhone, use Safari.";
    return root;
  }
  if (!window.isSecureContext) {
    btn.disabled = true;
    stateEl.textContent = "Needs a secure connection";
    notice.hidden = false;
    notice.innerHTML = "<strong>Microphone access needs HTTPS.</strong> Open this app over https:// or on localhost.";
    return root;
  }

  let recognizer = null;
  let ticker = 0;
  const rec = new Recorder({
    maxSeconds,
    onState: (s) => {
      if (s === "requesting") {
        stateEl.textContent = "Waiting for microphone permission…";
        btn.disabled = true;
      } else if (s === "recording") {
        stateEl.textContent = "Recording";
        btn.disabled = false;
        btn.classList.add("recording");
        meter.classList.add("live");
        btn.setAttribute("aria-label", "Stop recording");
        ticker = setInterval(() => (timerEl.textContent = fmtClock(rec.elapsed())), 250);
      } else {
        clearInterval(ticker);
        btn.classList.remove("recording");
        meter.classList.remove("live");
        meterBar.style.width = "0%";
        btn.setAttribute("aria-label", "Start recording");
        btn.disabled = false;
        if (s === "idle") stateEl.textContent = "Ready to record";
      }
    },
    onLevel: (lvl) => (meterBar.style.width = `${Math.round(lvl * 100)}%`),
  });

  btn.addEventListener("click", async () => {
    notice.hidden = true;
    if (rec.state === "recording") {
      btn.disabled = true;
      stateEl.textContent = "Finishing…";
      const browserText = recognizer ? await recognizer.stop() : "";
      const result = await rec.stop();
      recognizer = null;
      if (result) {
        stateEl.textContent = "Recorded";
        onDone({ ...result, browserText });
      }
      return;
    }
    try {
      await rec.start();
      if (useBrowserRecognition && browserRecognitionSupported()) {
        recognizer = new BrowserRecognizer();
        recognizer.start();
      }
    } catch (e) {
      notice.hidden = false;
      if (e.code === "denied") {
        stateEl.textContent = "Microphone blocked";
        notice.innerHTML = `<strong>Microphone permission was denied.</strong> ${deniedHelp()}`;
      } else if (e.code === "nodevice") {
        stateEl.textContent = "No microphone found";
        notice.innerHTML = "<strong>No microphone was found.</strong> Plug one in or check that another app is not using it.";
      } else {
        stateEl.textContent = "Could not start";
        notice.innerHTML = `<strong>The microphone could not be started.</strong> ${e.message ? e.message + ". " : ""}Check that this site is allowed to use the microphone and that no other app is holding it, then try again.`;
      }
    }
  });

  root.destroy = () => {
    clearInterval(ticker);
    if (rec.state === "recording") rec.cancel();
    recognizer?.stop();
  };
  return root;
}

// Artifact version: the viewer frame refuses the microphone, so the take is a file the user recorded
// elsewhere, plus an optional pasted transcript. Decoding the file up front catches non-audio uploads.
function uploadWidget({ targetSeconds, onDone }) {
  const root = h("div", { class: "recorder stack", "data-testid": "recorder" });
  const input = h("input", { type: "file", accept: "audio/*,.m4a,.mp3,.wav,.aac,.ogg,.webm", id: "take-file" });
  const stateEl = h("div", { class: "rec-state", "data-testid": "rec-state" }, "Ready for a recording");
  const transcriptIn = h("textarea", { class: "transcript-in", id: "take-transcript", placeholder: "Optional: paste the transcript here. In Voice Memos, open the recording, tap the transcript icon, select all, copy." });
  const notice = h("div", { class: "notice error", hidden: true, role: "alert" });
  const chooseBtn = h("button", { class: "btn primary block", type: "button", "data-testid": "choose-file", onClick: () => input.click() }, "Choose a recording");
  root.append(
    stateEl,
    h("div", { class: "upload-box" },
      h("p", { class: "small", style: "margin:0 0 10px" }, h("strong", {}, "Record in Voice Memos, then upload."), ` Aim for about ${targetSeconds || 45} seconds. Any audio file works.`),
      input,
      chooseBtn
    ),
    h("label", { class: "small muted", for: "take-transcript" }, "Transcript (optional, for pace and filler words)"),
    transcriptIn,
    h("p", { class: "tiny" }, "Without a transcript you still get pauses, speaking time and time to first word from the audio. Pasting the transcript is what unlocks pace, filler and hedging counts."),
    notice
  );
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    notice.hidden = true;
    stateEl.textContent = "Checking the file…";
    chooseBtn.disabled = true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const decoded = await ctx.decodeAudioData(await file.arrayBuffer());
      await ctx.close().catch(() => {});
      const duration = decoded.duration;
      if (duration > 600) throw new Error("That recording is over ten minutes. Trim it to a few minutes first.");
      stateEl.textContent = "Recording loaded";
      onDone({ blob: file, duration, mimeType: file.type || "audio/mp4", browserText: transcriptIn.value.trim(), pasted: Boolean(transcriptIn.value.trim()) });
    } catch (e) {
      stateEl.textContent = "Could not read that file";
      notice.hidden = false;
      notice.innerHTML = `<strong>That file could not be read as audio.</strong> ${e.message && !/decod/i.test(e.message) ? e.message : "Try a Voice Memos (.m4a), MP3 or WAV file."}`;
    } finally {
      chooseBtn.disabled = false;
      input.value = "";
    }
  });
  root.destroy = () => {};
  return root;
}
