// Role-play partner. Real model when ANTHROPIC_API_KEY is set, otherwise a scripted partner
// that is clearly labelled as scripted. Both follow the same turn contract.
import { ask, llmConfigured } from "./llm.js";
import { SCENARIOS, roleplayRules, scriptedReply } from "../public/lib/prompts.js";

export async function roleplayTurn({ scenarioId = "launch-slip", history = [] }) {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) throw new Error("Unknown scenario");
  const userTurns = history.filter((h) => h.role === "user").length;
  const finished = userTurns >= scenario.maxTurns;

  if (!llmConfigured()) {
    const r = scriptedReply(scenario, userTurns);
    return { ...r, source: "scripted", sourceLabel: "Scripted partner (demo). Replies do not react to what you said." };
  }

  const messages = [
    { role: "user", content: "(The conversation begins. You speak first with your opening line.)" },
    { role: "assistant", content: scenario.opening },
    ...history.map((h) => ({ role: h.role === "user" ? "user" : "assistant", content: String(h.text || "").slice(0, 2000) })),
  ];
  const { text, model } = await ask({ system: roleplayRules(scenario, finished), messages, maxTokens: 300 });
  return { reply: text || scenario.closing, finished, source: "anthropic", sourceLabel: `AI partner (${model}) replying to your transcribed answer` };
}
