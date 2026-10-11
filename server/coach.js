// Turns measured results into one short, honest coaching note.
// The model never sees the audio; it only sees the transcript and the numbers already measured.
import { ask, parseJson, llmConfigured } from "./llm.js";
import { COACH_RULES, buildCoachContext, normaliseCoachReply } from "../public/lib/prompts.js";
export { llmConfigured };

export async function coachNote(payload) {
  const { text, model } = await ask({ system: COACH_RULES, messages: [{ role: "user", content: buildCoachContext(payload || {}) }], maxTokens: 600 });
  return {
    ...normaliseCoachReply(parseJson(text)),
    source: "anthropic",
    sourceLabel: `AI coaching note (written by ${model} from the transcript and measures shown above)`,
  };
}
