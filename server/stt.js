// Speech-to-text via OpenAI Whisper. Used only when OPENAI_API_KEY is set.
// Returns word timestamps when available so the client can tie pauses to text.

const FILLER_HINT =
  "Um, uh, er, hmm, you know, I mean, like, so, basically, actually. Transcribe hesitations and filler words exactly as spoken.";

export function sttConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function extensionFor(mime) {
  const m = (mime || "").toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "mp4";
  if (m.includes("wav")) return "wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  return "webm";
}

export async function transcribe(buffer, mime) {
  const form = new FormData();
  const ext = extensionFor(mime);
  form.append("file", new Blob([buffer], { type: mime.split(";")[0] }), `recording.${ext}`);
  form.append("model", process.env.OPENAI_STT_MODEL || "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("prompt", FILLER_HINT);
  // Language is intentionally left to auto-detect; the product does not assume one accent or variety of English.

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  let resp;
  try {
    resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Whisper ${resp.status}: ${text.slice(0, 300)}`);
  }
  const data = await resp.json();
  const words = Array.isArray(data.words)
    ? data.words.map((w) => ({ word: String(w.word || "").trim(), start: Number(w.start), end: Number(w.end) }))
    : null;
  return {
    text: String(data.text || "").trim(),
    words,
    language: data.language || null,
    source: "openai-whisper",
    sourceLabel: "Transcribed from your audio by OpenAI Whisper",
    real: true,
  };
}
