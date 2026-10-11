// Loads the bundled artifact page locally with a stubbed window.claude runtime and walks the
// upload-based journey. Catches bundling errors and artifact-mode regressions before publishing.
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const OUT = process.env.SHOT_DIR || path.join(os.tmpdir(), "speakwell-shots");
fs.mkdirSync(OUT, { recursive: true });
const page_html = fs.readFileSync("dist/artifact.html", "utf8");
const wav = fs.existsSync(path.join(OUT, "speech.wav")) ? path.join(OUT, "speech.wav") : null;
if (!wav) { console.log("Run tests/journey.test.mjs first to generate speech.wav"); process.exit(1); }

let failures = 0;
const check = (c, m) => { if (c) console.log("  ✓", m); else { failures++; console.log("  ✗", m); } };

// Minimal stand-in for the artifact runtime: `claude.use("sample")` resolves a function + json().
const STUB = `
  window.claude = { use: async (name) => {
    if (name !== "sample") return null;
    const fn = async (input, opts) => ({ text: "That is a clear reason and a date. What changes so it does not happen again?", truncated: false, modelTierApplied: "quick" });
    fn.json = async (input) => ({ observation: "You said “we ship Thursday” plainly.", nextStep: "Next attempt, state the date in your first sentence.", quote: "we ship Thursday", checklist: [{item: "x", status: "met", evidence: "we ship Thursday"}, {item: "y", status: "unclear", evidence: "no date given"}, {item: "z", status: "not met", evidence: "I think maybe"}] });
    fn.limits = async () => ({ maxPromptBytes: 262144 });
    return fn;
  } };
`;
const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><script>${STUB}</script></head><body style="margin:0">${page_html}</body></html>`;
const file = path.join(OUT, "artifact-local.html");
fs.writeFileSync(file, doc);

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["iPhone 13"] });
const page = await context.newPage();
page.on("pageerror", (e) => { failures++; console.log("  ✗ page error:", e.message); });
page.on("console", (m) => m.type() === "error" && console.log("  console.error:", m.text()));

console.log("\nArtifact mode (bundled page, stubbed runtime, uploaded audio)");
await page.goto("file://" + file);
await page.getByTestId("goal-clear").click();
await page.getByTestId("situation-meeting").click();
await page.getByTestId("finish-onboarding").click();
await page.waitForSelector('[data-testid="start-baseline"]');
check((await page.locator("#service-badge").textContent()).includes("Claude live"), "badge reports Claude live through the artifact runtime");
await page.getByTestId("start-baseline").click();
await page.getByTestId("baseline-intro").click();
await page.waitForSelector('[data-testid="choose-file"]');
check(true, "record screen offers file upload instead of a microphone");
await page.fill("#take-transcript", "Hi, I'm Chen, I lead omnichannel. I think maybe we ship Thursday. What do you need from me?");
await page.setInputFiles("#take-file", wav);
await page.waitForSelector("audio");
await page.screenshot({ path: path.join(OUT, "20-artifact-upload.png"), fullPage: true });
await page.getByTestId("analyse").click();
await page.waitForSelector('[data-testid="transcript"]', { timeout: 30000 });
await page.waitForFunction(() => /AI coaching note/.test(document.querySelector('[data-testid="tip"]')?.textContent || ""), null, { timeout: 15000 });
const t1 = await page.locator("#main").innerText();
check(/Pasted transcript/.test(t1), "pasted transcript is labelled as such");
check(/hedging phrase/.test(t1), "hedging measure shown");
check(/state the date in your first sentence/.test(t1), "AI coaching note from the stubbed runtime is rendered");
await page.screenshot({ path: path.join(OUT, "21-artifact-feedback.png"), fullPage: true });

// Retry → compare, then delete via in-page confirm
await page.getByTestId("retry").click();
await page.waitForSelector('[data-testid="choose-file"]');
await page.setInputFiles("#take-file", wav);
await page.waitForSelector("audio");
await page.getByTestId("analyse").click();
await page.waitForSelector('[data-testid="compare"]', { timeout: 30000 });
check(/No transcript was pasted/.test(await page.locator("#main").innerText()), "take without transcript says so instead of showing a demo");
await page.getByTestId("compare").click();
await page.waitForSelector('[data-testid="compare-table"]');
check((await page.locator("audio").count()) === 2, "compare works in artifact mode");
await page.locator('a[href="#/progress"]').first().click();
await page.waitForSelector('[data-testid="session-item"]');
check((await page.locator('[data-testid="session-item"]').count()) === 2, "progress lists both takes without URL hash routing");
await page.locator('[data-testid="session-item"]').first().getByRole("button", { name: /^Delete/ }).click();
await page.getByTestId("confirm-yes").click();
await page.waitForFunction(() => document.querySelectorAll('[data-testid="session-item"]').length === 1);
check(true, "in-page confirm deletes a recording");

// Role-play through the stub
await page.locator('a[href="#/roleplay"]').first().click();
await page.waitForSelector('[data-testid="choose-file"]');
await page.fill("#take-transcript", "The payment provider changed their API. New date is the fourteenth.");
await page.setInputFiles("#take-file", wav);
await page.waitForSelector('[data-testid="send-answer"]');
await page.getByTestId("send-answer").click();
await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat"] .bubble.partner').length >= 2, null, { timeout: 30000 });
check(/What changes so it does not happen again/.test(await page.locator("#main").innerText()), "role-play partner reply comes from the runtime");
await page.screenshot({ path: path.join(OUT, "22-artifact-roleplay.png"), fullPage: true });

await browser.close();
console.log(`\n${failures ? `${failures} check(s) failed` : "All artifact checks passed"}`);
process.exit(failures ? 1 : 0);
