// Role-play partner. Real model when ANTHROPIC_API_KEY is set, otherwise a scripted partner
// that is clearly labelled as scripted. Both follow the same turn contract.
import { ask, llmConfigured } from "./llm.js";

const SCENARIOS = {
  "launch-slip": {
    title: "Stakeholder asks why the launch slipped",
    persona:
      "You are Dana, a direct but fair commercial director. A product launch you sponsor has slipped by three weeks. You want a clear reason, the new date, and what will stop it happening again. You are not hostile, but you do not accept vague answers and you will ask a follow-up if the answer dodges.",
    opening: "Thanks for making time. I saw the launch date moved by three weeks. Walk me through what happened.",
    script: [
      "Okay. That helps, but I'm hearing the reason and not the plan. What's the new date, and how confident are you in it?",
      "Fair. Last question: what changes so I'm not sitting here again next quarter?",
    ],
    closing: "Understood. I appreciate the straight answer. Let's lock the new date in writing today and move on.",
    maxTurns: 3,
  },
};

export function listScenarios() {
  return Object.entries(SCENARIOS).map(([id, s]) => ({ id, title: s.title, opening: s.opening, maxTurns: s.maxTurns }));
}

export async function roleplayTurn({ scenarioId = "launch-slip", history = [] }) {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) throw new Error("Unknown scenario");
  const userTurns = history.filter((h) => h.role === "user").length;
  const finished = userTurns >= scenario.maxTurns;

  if (!llmConfigured()) {
    const reply = finished ? scenario.closing : scenario.script[userTurns - 1] || scenario.closing;
    return { reply, finished: finished || userTurns >= scenario.maxTurns, source: "scripted", sourceLabel: "Scripted partner (demo). Replies do not react to what you said." };
  }

  const system = `${scenario.persona}

You are role-playing a workplace conversation so the other person can practise. Stay in character as Dana. Respond only to what they actually said, in one to three sentences, as spoken dialogue. No stage directions, no coaching, no bullet points. If their answer was vague, ask one pointed follow-up. If it was clear, acknowledge it and move the conversation on. ${finished ? "This is the final exchange: close the conversation naturally in one or two sentences." : ""}`;

  const messages = [
    { role: "assistant", content: scenario.opening },
    ...history.map((h) => ({ role: h.role === "user" ? "user" : "assistant", content: String(h.text || "").slice(0, 2000) })),
  ];
  // The API requires the conversation to start with a user turn; frame the opening as the scene.
  const framed = [{ role: "user", content: "(The conversation begins. You speak first with your opening line.)" }, ...messages];

  const { text, model } = await ask({ system, messages: framed, maxTokens: 300 });
  return { reply: text || scenario.closing, finished, source: "anthropic", sourceLabel: `AI partner (${model}) replying to your transcribed answer` };
}
