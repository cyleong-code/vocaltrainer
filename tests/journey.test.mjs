// End-to-end acceptance run on a phone viewport with a fake microphone.
// Needs: the server running on PORT (default 3000) and Chromium available to Playwright.
import { chromium, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = process.env.SHOT_DIR || path.join(os.tmpdir(), "speakwell-shots");
fs.mkdirSync(OUT, { recursive: true });

// 16-bit PCM WAV: speech-like tone bursts (0.75s on / 0.75s off) with one 3s gap, or pure silence.
function makeWav(file, { seconds = 16, silent = false } = {}) {
  const sr = 16000;
  const n = sr * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = 0;
    if (!silent) {
      const on = Math.sin((2 * Math.PI * t) / 1.5) > 0 && !(t > 7 && t < 10);
      // a few harmonics and slow amplitude wobble so it looks like voiced speech to an energy detector
      v = on ? 0.35 * (Math.sin(2 * Math.PI * 180 * t) + 0.5 * Math.sin(2 * Math.PI * 360 * t) + 0.25 * Math.sin(2 * Math.PI * 720 * t)) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 3 * t)) : 0;
    }
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767 * 0.6))), 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
  return file;
}

const speechWav = makeWav(path.join(OUT, "speech.wav"));
const silentWav = makeWav(path.join(OUT, "silent.wav"), { silent: true });

let failures = 0;
function check(cond, msg) {
  if (cond) console.log("  ✓", msg);
  else { failures++; console.log("  ✗", msg); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(wav, { grant = true } = {}) {
  const args = ["--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"];
  if (wav) args.push(`--use-file-for-fake-audio-capture=${wav}`);
  if (grant) args.push("--use-fake-ui-for-media-stream");
  const browser = await chromium.launch({ args });
  const context = await browser.newContext({ ...devices["iPhone 13"], permissions: grant ? ["microphone"] : [], defaultBrowserType: "chromium" });
  const page = await context.newPage();
  page.on("pageerror", (e) => { failures++; console.log("  ✗ page error:", e.message); });
  page.on("console", (m) => m.type() === "error" && console.log("  console.error:", m.text()));
  page.on("dialog", (d) => d.accept());
  return { browser, page };
}

async function recordTake(page, seconds) {
  await page.getByTestId("rec-button").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="rec-state"]')?.textContent === "Recording", null, { timeout: 8000 });
  await sleep(seconds * 1000);
  await page.getByTestId("rec-button").click();
  await page.waitForSelector("audio", { timeout: 8000 });
}

async function mainJourney() {
  console.log("\nMain journey (fake mic with speech-like audio)");
  const { browser, page } = await launch(speechWav);
  await page.goto(BASE);

  // Onboarding
  await page.getByTestId("goal-fillers").click();
  await page.getByTestId("situation-presentation").click();
  await page.screenshot({ path: path.join(OUT, "01-onboarding.png") });
  await page.getByTestId("finish-onboarding").click();
  await page.waitForSelector('[data-testid="start-baseline"]');
  check(await page.locator("#service-badge").textContent() === "Demo mode", "service badge shows Demo mode without credentials");
  await page.screenshot({ path: path.join(OUT, "02-home.png") });

  // Baseline
  await page.getByTestId("start-baseline").click();
  await page.getByTestId("baseline-intro").click();
  await page.waitForSelector('[data-testid="rec-button"]');
  check((await page.getByTestId("rec-state").textContent()) === "Ready to record", "recorder starts in Ready state");
  await page.getByTestId("rec-button").click();
  await page.waitForFunction(() => document.querySelector('[data-testid="rec-state"]')?.textContent === "Recording", null, { timeout: 8000 });
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, "03-recording.png") });
  await sleep(10500);
  await page.getByTestId("rec-button").click();
  await page.waitForSelector("audio", { timeout: 8000 });
  check(true, "take recorded and playback element shown before saving");
  await page.screenshot({ path: path.join(OUT, "04-review-take.png") });
  await page.getByTestId("analyse").click();
  await page.waitForURL(/#\/session\//, { timeout: 30000 });
  await page.waitForSelector('[data-testid="transcript"]', { timeout: 15000 });
  const body1 = await page.locator("#main").innerText();
  check(/Demo transcript/.test(body1), "feedback labels the transcript as a demo (no STT configured)");
  check(/audible pause/.test(body1), "feedback shows pause measure from audio");
  check(/from your audio/.test(body1), "measures carry their source label");
  check((await page.getByTestId("tip").innerText()).includes("Next attempt"), "one next-step tip is shown");
  const pauseCount = Number((body1.match(/(\d+)\s*\n?audible pause/) || [])[1]);
  check(pauseCount >= 3, `pause detection found pauses in the burst audio (${pauseCount})`);
  await page.screenshot({ path: path.join(OUT, "05-feedback.png"), fullPage: true });
  const firstUrl = page.url();

  // Retry
  await page.getByTestId("retry").click();
  await page.waitForSelector('[data-testid="rec-button"]');
  check(/Attempt 2/.test(await page.locator("#main").innerText()), "retry screen labelled as attempt 2");
  await recordTake(page, 7);
  await page.getByTestId("analyse").click();
  await page.waitForURL((u) => /#\/session\//.test(u.toString()) && u.toString() !== firstUrl, { timeout: 30000 });
  await page.waitForSelector('[data-testid="compare"]', { timeout: 15000 });
  check(/Attempt 2 of 2/.test(await page.locator("#main").innerText()), "second attempt shows 'Attempt 2 of 2'");

  // Compare
  await page.getByTestId("compare").click();
  await page.waitForSelector('[data-testid="compare-table"]');
  check((await page.locator("audio").count()) === 2, "compare screen has two players");
  check((await page.locator('[data-testid="compare-table"] tbody tr').count()) >= 6, "compare table lists measures");
  await page.screenshot({ path: path.join(OUT, "06-compare.png"), fullPage: true });

  // Progress + delete
  await page.goto(`${BASE}/#/progress`);
  await page.waitForSelector('[data-testid="session-item"]');
  check((await page.locator('[data-testid="session-item"]').count()) === 2, "progress lists both recordings");
  await page.screenshot({ path: path.join(OUT, "07-progress.png"), fullPage: true });
  await page.locator('[data-testid="session-item"]').first().getByRole("button", { name: /^Delete/ }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="session-item"]').length === 1);
  check(true, "deleting a recording removes it from the list");
  await page.goto(`${BASE}/#/`);
  await page.waitForSelector('[data-testid="start-exercise"]');
  check(/Today's exercise/.test(await page.locator("#main").innerText()), "home shows today's exercise after baseline");
  await page.screenshot({ path: path.join(OUT, "08-home-exercise.png"), fullPage: true });

  // Delete from feedback screen
  await page.locator('[data-testid="start-exercise"]').click();
  await page.waitForSelector('[data-testid="rec-button"]');
  await recordTake(page, 5);
  await page.getByTestId("analyse").click();
  await page.waitForURL(/#\/session\//, { timeout: 30000 });
  await page.waitForSelector('[data-testid="delete"]');
  await page.getByTestId("delete").click();
  await page.waitForURL(/#\/progress/);
  await page.waitForSelector('[data-testid="session-item"]');
  check((await page.locator('[data-testid="session-item"]').count()) === 1, "delete from feedback screen works");

  // Role-play (scripted partner in demo mode)
  await page.goto(`${BASE}/#/roleplay`);
  await page.waitForSelector('[data-testid="rec-button"]');
  check(/Scripted partner/.test(await page.locator("#main").innerText()), "role-play is labelled as scripted when no AI key");
  await recordTake(page, 5);
  await page.getByTestId("send-answer").click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat"] .bubble.partner').length >= 2, null, { timeout: 30000 });
  check((await page.locator('[data-testid="chat"] .bubble.me').count()) === 1, "user's answer appears in the chat with a transcript badge");
  check(/Your answer 2 of 3/.test(await page.locator("#main").innerText()), "partner replied and asks for answer 2");
  await page.screenshot({ path: path.join(OUT, "09-roleplay.png"), fullPage: true });

  await page.goto(`${BASE}/#/settings`);
  await page.waitForSelector("h1");
  await page.screenshot({ path: path.join(OUT, "10-settings.png"), fullPage: true });
  await browser.close();
}

async function silentTake() {
  console.log("\nSilent recording");
  const { browser, page } = await launch(silentWav);
  await page.goto(BASE);
  await page.getByTestId("goal-pace").click();
  await page.getByTestId("situation-meeting").click();
  await page.getByTestId("finish-onboarding").click();
  await page.waitForSelector('[data-testid="start-baseline"]');
  await page.goto(`${BASE}/#/record/baseline-passage`);
  await page.waitForSelector('[data-testid="rec-button"]');
  await recordTake(page, 4);
  await page.getByTestId("analyse").click();
  await page.waitForURL(/#\/session\//, { timeout: 30000 });
  await page.waitForSelector('[data-testid="retry"]');
  const text = await page.locator("#main").innerText();
  check(/Little or no speech was detected/.test(text), "silent audio is reported, not analysed");
  check(!/Demo transcript/.test(text), "no demo transcript is shown for silent audio");
  await page.screenshot({ path: path.join(OUT, "11-silent.png"), fullPage: true });
  await browser.close();
}

async function deniedPermission() {
  console.log("\nDenied microphone permission");
  const { browser, page } = await launch(null, { grant: false });
  await page.goto(`${BASE}/#/record/baseline-intro`);
  await page.waitForSelector('[data-testid="rec-button"]');
  await page.getByTestId("rec-button").click();
  await page.waitForFunction(() => /blocked|denied|could not/i.test(document.querySelector('[data-testid="rec-state"]')?.textContent || ""), null, { timeout: 8000 });
  const text = await page.locator("#main").innerText();
  check(/permission was denied|could not be started/i.test(text), "denied permission shows plain-language help");
  await page.screenshot({ path: path.join(OUT, "12-denied.png") });
  await browser.close();
}

try {
  await mainJourney();
  await silentTake();
  await deniedPermission();
} catch (e) {
  failures++;
  console.log("  ✗ test crashed:", e.message);
}
console.log(`\n${failures ? `${failures} check(s) failed` : "All checks passed"}. Screenshots in ${OUT}`);
process.exit(failures ? 1 : 0);
