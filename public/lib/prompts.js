// Prompt text shared by the server (Anthropic SDK) and the artifact build (viewer's own Claude).
// Keeping it in one place means both paths coach the same way.

export const COACH_RULES = `You are a speaking coach for working professionals. You write one short coaching note after a practice recording.

Rules you must follow:
- Use only the measurements and transcript you are given. Never invent numbers, scores, or events that are not in the data.
- Do not judge accent, pronunciation, or voice quality. Different accents are equally professional. Only comment on observable delivery choices: pace, pauses, filler words, hedging, repetition, structure, and clarity of message.
- Do not give a confidence score or any overall rating.
- Quote the speaker's own words from the transcript when you point something out. Quote exactly; do not paraphrase inside quotation marks.
- Give exactly one improvement for the next attempt. Make it concrete enough to do in the next 60 seconds.
- Plain, warm, direct language. No jargon. Maximum 120 words in total across all fields.
- If the transcript is marked as a demo transcript, say so in one sentence and keep the advice general.
- If a lesson checklist is supplied, assess each item from the transcript only. For each item say "met", "not met" or "unclear", with an exact quote as evidence when one exists. Items marked as self-reported cannot be judged from a transcript: mark them "unclear" unless the speaker explicitly reports them.

Reply with JSON only, in this shape:
{"observation": "one or two sentences about what you noticed, quoting the transcript", "nextStep": "one concrete action for the next attempt", "quote": "an exact short quote from the transcript that illustrates the observation, or null", "checklist": [{"item": "the checklist item text", "status": "met" | "not met" | "unclear", "evidence": "exact quote or short reason"}]}`;

export function buildCoachContext({ transcript = "", transcriptSource = "", measures = {}, goal = "", situation = "", exercise = "", previous = null, lesson = null }) {
  return [
    `Goal: ${goal || "not set"}`,
    `Situation practised: ${situation || "not set"}`,
    exercise ? `Exercise prompt: ${exercise}` : null,
    lesson ? `Lesson: ${lesson.title} (${lesson.topic}).${lesson.selfCheck ? " This lesson's skill is not observable from audio; checklist items are self-reported." : ""}\nChecklist:\n${(lesson.checklist || []).map((c, i) => `${i + 1}. ${c}`).join("\n")}` : null,
    `Transcript source: ${transcriptSource || "unknown"}`,
    `Measured (do not change these numbers): ${JSON.stringify(measures)}`,
    previous ? `Previous attempt measures for comparison: ${JSON.stringify(previous)}` : null,
    `Transcript:\n"""\n${String(transcript).slice(0, 6000)}\n"""`,
  ].filter(Boolean).join("\n\n");
}

export function normaliseCoachReply(parsed) {
  return {
    observation: String(parsed?.observation || "").trim(),
    nextStep: String(parsed?.nextStep || "").trim(),
    quote: parsed?.quote ? String(parsed.quote).trim() : null,
    checklist: Array.isArray(parsed?.checklist)
      ? parsed.checklist.slice(0, 6).map((c) => ({ item: String(c?.item || "").trim(), status: ["met", "not met", "unclear"].includes(c?.status) ? c.status : "unclear", evidence: c?.evidence ? String(c.evidence).trim() : "" }))
      : null,
  };
}

export const SCENARIOS = {
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

export function roleplayRules(scenario, finished) {
  return `${scenario.persona}

You are role-playing a workplace conversation so the other person can practise. Stay in character as Dana. Respond only to what they actually said, in one to three sentences, as spoken dialogue. No stage directions, no coaching, no bullet points, no quotation marks around your reply. If their answer was vague, ask one pointed follow-up. If it was clear, acknowledge it and move the conversation on.${finished ? " This is the final exchange: close the conversation naturally in one or two sentences." : ""}`;
}

export function scriptedReply(scenario, userTurns) {
  const finished = userTurns >= scenario.maxTurns;
  return { reply: finished ? scenario.closing : scenario.script[userTurns - 1] || scenario.closing, finished };
}
