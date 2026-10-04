// Calls to our own server. Nothing here talks to a third party directly.
let configCache = null;

export async function getConfig() {
  if (configCache) return configCache;
  try {
    const r = await fetch("/api/config");
    configCache = await r.json();
  } catch {
    configCache = { stt: false, llm: false, offline: true };
  }
  return configCache;
}

export async function transcribeOnServer(blob) {
  const r = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": blob.type || "audio/webm" }, body: blob });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.message || "Transcription failed");
    err.code = data.error || "stt_failed";
    throw err;
  }
  return data;
}

export async function requestCoachNote(payload) {
  const r = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error("coach_failed");
  return r.json();
}

export async function requestRoleplayTurn(payload) {
  const r = await fetch("/api/roleplay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error("roleplay_failed");
  return r.json();
}
