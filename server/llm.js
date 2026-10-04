// Thin wrapper over the Anthropic SDK. One place to handle model choice, refusal fallbacks and JSON parsing.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
let client = null;

export function llmConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 45_000, maxRetries: 1 });
  return client;
}

function textOf(response) {
  return response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

// Ask for a short answer. Server-side refusal fallbacks are requested first; if the
// account or proxy rejects that beta, retry once as a plain request.
export async function ask({ system, messages, maxTokens = 1500 }) {
  const c = getClient();
  const base = { model: MODEL, max_tokens: maxTokens, system, messages, output_config: { effort: "low" } };
  let response;
  try {
    response = await c.beta.messages.create({ ...base, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  } catch (err) {
    if (err instanceof Anthropic.BadRequestError) {
      response = await c.messages.create(base);
    } else {
      throw err;
    }
  }
  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to answer this request.");
  }
  return { text: textOf(response), model: response.model };
}

// Pull the first JSON object out of a reply, tolerating code fences or a sentence before it.
export function parseJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON in model reply");
  return JSON.parse(text.slice(start, end + 1));
}
