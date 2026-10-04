import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transcribe, sttConfigured } from "./stt.js";
import { coachNote, llmConfigured } from "./coach.js";
import { roleplayTurn } from "./roleplay.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const MAX_AUDIO_MB = Number(process.env.MAX_AUDIO_MB || 20);

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "microphone=(self)");
  next();
});

// Which services are really wired up. The client uses this to label every result honestly.
app.get("/api/config", (_req, res) => {
  res.json({
    stt: sttConfigured(),
    llm: llmConfigured(),
    maxAudioMb: MAX_AUDIO_MB,
  });
});

// Raw audio in, transcript out. Nothing is written to disk; the buffer is dropped after the call.
app.post(
  "/api/transcribe",
  express.raw({ type: ["audio/*", "video/*", "application/octet-stream"], limit: `${MAX_AUDIO_MB}mb` }),
  async (req, res) => {
    if (!sttConfigured()) {
      return res.status(503).json({ error: "stt_not_configured", message: "No speech-to-text service is configured on the server." });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length < 1000) {
      return res.status(400).json({ error: "empty_audio", message: "The recording was empty or too short to transcribe." });
    }
    try {
      const result = await transcribe(req.body, req.headers["content-type"] || "audio/webm");
      res.json(result);
    } catch (err) {
      console.error("[transcribe]", err?.message || err);
      res.status(502).json({ error: "stt_failed", message: "Transcription failed. You can retry, or review the audio-only measures." });
    }
  }
);

app.use(express.json({ limit: "200kb" }));

app.post("/api/coach", async (req, res) => {
  if (!llmConfigured()) {
    return res.status(503).json({ error: "llm_not_configured" });
  }
  try {
    const note = await coachNote(req.body || {});
    res.json(note);
  } catch (err) {
    console.error("[coach]", err?.message || err);
    res.status(502).json({ error: "llm_failed", message: "The coaching service did not respond. The rule-based tip is shown instead." });
  }
});

app.post("/api/roleplay", async (req, res) => {
  try {
    const turn = await roleplayTurn(req.body || {});
    res.json(turn);
  } catch (err) {
    console.error("[roleplay]", err?.message || err);
    res.status(502).json({ error: "llm_failed", message: "The conversation partner did not respond. Try again." });
  }
});

app.use((err, _req, res, _next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "too_large", message: `Recording is larger than ${MAX_AUDIO_MB} MB. Try a shorter take.` });
  }
  console.error(err);
  res.status(500).json({ error: "server_error" });
});

app.use(express.static(path.join(here, "..", "public"), { extensions: ["html"] }));
app.get("*", (_req, res) => res.sendFile(path.join(here, "..", "public", "index.html")));

app.listen(PORT, () => {
  console.log(`SpeakWell listening on http://localhost:${PORT}`);
  console.log(`  speech-to-text: ${sttConfigured() ? "OpenAI Whisper" : "not configured (browser recognition / demo transcript)"}`);
  console.log(`  coach + role-play: ${llmConfigured() ? "Anthropic Claude" : "not configured (rule-based tip / scripted partner)"}`);
});
