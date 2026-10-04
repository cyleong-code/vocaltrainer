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

export function recorderWidget({ maxSeconds = 120, targetSeconds, useBrowserRecognition = false, onDone }) {
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
