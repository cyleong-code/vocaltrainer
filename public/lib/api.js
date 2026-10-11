// Calls to our own server, or, inside a published artifact, to the viewer's own Claude through the
// artifact runtime. Nothing here talks to a third party directly.
import { COACH_RULES, buildCoachContext, normaliseCoachReply, SCENARIOS, roleplayRules, scriptedReply } from "./prompts.js";

export const ARTIFACT_MODE = typeof window !== "undefined" && window.SPEAKWELL_MODE === "artifact";
let configCache = null;
let samplePromise = null;

function getSample() {
  if (!samplePromise) {
    samplePromise = typeof window.claude?.use === "function" ? window.claude.use("sample").catch(() => null) : Promise.resolve(null);
  }
  return samplePromise;
}

export async function getConfig() {
  if (configCache) return configCache;
  if (ARTIFACT_MODE) {
    const sample = await getSample();
    configCache = { stt: false, llm: Boolean(sample), artifact: true, upload: true };
    return configCache;
  }
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
  if (ARTIFACT_MODE) {
    const sample = await getSample();
    if (!sample) throw new Error("coach_unavailable");
    const prompt = `${COACH_RULES}\n\n---\n\n${buildCoachContext(payload)}`;
    const parsed = await sample.json(prompt, { modelTier: "default", effort: "low", cache: { gcTime: 86400000 } });
    return { ...normaliseCoachReply(parsed), source: "claude-artifact", sourceLabel: "AI coaching note (Claude, through your own Claude account, from the transcript and measures shown above)" };
  }
  const r = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error("coach_failed");
  return r.json();
}

export async function requestRoleplayTurn({ scenarioId = "launch-slip", history = [] }) {
  if (ARTIFACT_MODE) {
    const scenario = SCENARIOS[scenarioId];
    const userTurns = history.filter((h) => h.role === "user").length;
    const finished = userTurns >= scenario.maxTurns;
    const sample = await getSample();
    if (!sample) {
      return { ...scriptedReply(scenario, userTurns), source: "scripted", sourceLabel: "Scripted partner (demo). Replies do not react to what you said." };
    }
    const turns = [
      { role: "user", content: `${roleplayRules(scenario, finished)}\n\n(The conversation begins. Your opening line was: "${scenario.opening}")` },
      { role: "assistant", content: scenario.opening },
      ...history.map((h) => ({ role: h.role === "user" ? "user" : "assistant", content: String(h.text || "").slice(0, 2000) })),
    ];
    const { text } = await sample(turns, { modelTier: "quick", cache: false });
    return { reply: text.trim() || scenario.closing, finished, source: "claude-artifact", sourceLabel: "AI partner (Claude, through your own Claude account) replying to your transcript" };
  }
  const r = await fetch("/api/roleplay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenarioId, history }) });
  if (!r.ok) throw new Error("roleplay_failed");
  return r.json();
}
