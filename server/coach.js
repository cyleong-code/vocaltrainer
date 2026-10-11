// Turns measured results into one short, honest coaching note.
// The model never sees the audio; it only sees the transcript and the numbers already measured.
import { ask, parseJson, llmConfigured } from "./llm.js";
export { llmConfigured };

const SYSTEM = `You are a speaking coach for working professionals. You write one short coaching note after a practice recording.

Rules you must follow:
- Use only the measurements and transcript you are given. Never invent numbers, scores, or events that are not in the data.
- Do not judge accent, pronunciation, or voice quality. Different accents are equally professional. Only comment on observable delivery choices: pace, pauses, filler words, repetition, structure, and clarity of message.
- Do not give a confidence score or any overall rating.
- Quote the speaker's own words from the transcript when you point something out. Quote exactly; do not paraphrase inside quotation marks.
- Give exactly one improvement for the next attempt. Make it concrete enough to do in the next 60 seconds.
- Plain, warm, direct language. No jargon. Maximum 120 words in total across all fields.
- If the transcript is marked as a demo transcript, say so in one sentence and keep the advice general.

If a lesson checklist is supplied, assess each item from the transcript only. For each item say "met", "not met" or "unclear", with an exact quote as evidence when one exists. Items marked as self-reported cannot be judged from a transcript: mark them "unclear" unless the speaker explicitly reports them.

Reply with JSON only, in this shape:
{"observation": "one or two sentences about what you noticed, quoting the transcript", "nextStep": "one concrete action for the next attempt", "quote": "an exact short quote from the transcript that illustrates the observation, or null", "checklist": [{"item": "the checklist item text", "status": "met" | "not met" | "unclear", "evidence": "exact quote or short reason"}]}`;

export async function coachNote(payload) {
  const { transcript = "", transcriptSource = "", measures = {}, goal = "", situation = "", exercise = "", previous = null, lesson = null } = payload;
  const safeTranscript = String(transcript).slice(0, 6000);
  const user = [
    `Goal: ${goal || "not set"}`,
    `Situation practised: ${situation || "not set"}`,
    exercise ? `Exercise prompt: ${exercise}` : null,
    lesson ? `Lesson: ${lesson.title} (${lesson.topic}).${lesson.selfCheck ? " This lesson's skill is not observable from audio; checklist items are self-reported." : ""}\nChecklist:\n${(lesson.checklist || []).map((c, i) => `${i + 1}. ${c}`).join("\n")}` : null,
    `Transcript source: ${transcriptSource || "unknown"}`,
    `Measured (do not change these numbers): ${JSON.stringify(measures)}`,
    previous ? `Previous attempt measures for comparison: ${JSON.stringify(previous)}` : null,
    `Transcript:\n"""\n${safeTranscript}\n"""`,
  ].filter(Boolean).join("\n\n");

  const { text, model } = await ask({ system: SYSTEM, messages: [{ role: "user", content: user }], maxTokens: 600 });
  const parsed = parseJson(text);
  return {
    observation: String(parsed.observation || "").trim(),
    nextStep: String(parsed.nextStep || "").trim(),
    quote: parsed.quote ? String(parsed.quote).trim() : null,
    checklist: Array.isArray(parsed.checklist)
      ? parsed.checklist.slice(0, 6).map((c) => ({ item: String(c.item || "").trim(), status: ["met", "not met", "unclear"].includes(c.status) ? c.status : "unclear", evidence: c.evidence ? String(c.evidence).trim() : "" }))
      : null,
    source: "anthropic",
    sourceLabel: `AI coaching note (written by ${model} from the transcript and measures shown above)`,
  };
}
