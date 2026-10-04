// Microphone recording with explicit states so the UI can always say what is happening.
// States: idle -> requesting -> recording -> stopped. Errors carry a `code` the UI maps to plain-language help.

export function recordingSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

export function pickMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/mp4;codecs=mp4a.40.2"];
  for (const c of candidates) if (MediaRecorder.isTypeSupported?.(c)) return c;
  return "";
}

export class Recorder {
  constructor({ onState, onLevel, maxSeconds = 180 } = {}) {
    this.onState = onState || (() => {});
    this.onLevel = onLevel || (() => {});
    this.maxSeconds = maxSeconds;
    this.state = "idle";
    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this.startedAt = 0;
    this.audioCtx = null;
    this.raf = 0;
    this.timer = 0;
  }

  setState(s, extra) {
    this.state = s;
    this.onState(s, extra);
  }

  async start() {
    if (!recordingSupported()) {
      const err = new Error("This browser cannot record audio.");
      err.code = "unsupported";
      throw err;
    }
    this.setState("requesting");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      this.setState("idle");
      const err = new Error(e?.message || "Microphone unavailable");
      err.code = e?.name === "NotAllowedError" || e?.name === "SecurityError" ? "denied" : e?.name === "NotFoundError" ? "nodevice" : "failed";
      throw err;
    }
    this.chunks = [];
    const mimeType = pickMimeType();
    this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.mediaRecorder.ondataavailable = (e) => e.data && e.data.size && this.chunks.push(e.data);
    this.mediaRecorder.start(250);
    this.startedAt = performance.now();
    this.setState("recording");
    this.startMeter();
    this.timer = setTimeout(() => this.state === "recording" && this.stop(), this.maxSeconds * 1000);
  }

  startMeter() {
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = this.audioCtx.createMediaStreamSource(this.stream);
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const loop = () => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        this.onLevel(Math.min(1, rms * 6), (performance.now() - this.startedAt) / 1000);
        this.raf = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      /* meter is optional */
    }
  }

  elapsed() {
    return this.state === "recording" ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.state !== "recording") return resolve(null);
      clearTimeout(this.timer);
      const duration = (performance.now() - this.startedAt) / 1000;
      this.mediaRecorder.onstop = () => {
        const type = this.mediaRecorder.mimeType || this.chunks[0]?.type || "audio/webm";
        const blob = new Blob(this.chunks, { type });
        this.cleanup();
        this.setState("stopped", { blob, duration });
        resolve({ blob, duration, mimeType: type });
      };
      this.mediaRecorder.stop();
    });
  }

  cancel() {
    clearTimeout(this.timer);
    try {
      this.mediaRecorder?.state !== "inactive" && this.mediaRecorder?.stop();
    } catch {}
    this.cleanup();
    this.setState("idle");
  }

  cleanup() {
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
  }
}

// Optional live speech recognition in the browser (Chrome, Edge, Safari). Real transcription of the
// user's voice, but without word timings and with fillers often dropped. Audio is processed by the
// browser vendor's service, which the UI discloses.
export function browserRecognitionSupported() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export class BrowserRecognizer {
  constructor() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.rec = Ctor ? new Ctor() : null;
    this.finals = [];
    this.interim = "";
    this.error = null;
    if (this.rec) {
      this.rec.continuous = true;
      this.rec.interimResults = true;
      this.rec.maxAlternatives = 1;
      this.rec.onresult = (e) => {
        this.interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) this.finals.push(r[0].transcript.trim());
          else this.interim += r[0].transcript;
        }
      };
      this.rec.onerror = (e) => {
        this.error = e.error;
      };
    }
  }
  start() {
    try {
      this.rec?.start();
    } catch {}
  }
  stop() {
    return new Promise((resolve) => {
      if (!this.rec) return resolve(this.text());
      const done = () => resolve(this.text());
      this.rec.onend = done;
      try {
        this.rec.stop();
      } catch {
        done();
      }
      setTimeout(done, 1500);
    });
  }
  text() {
    return [...this.finals, this.interim].join(" ").replace(/\s+/g, " ").trim();
  }
}
