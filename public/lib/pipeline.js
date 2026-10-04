// From a finished recording to a saved, analysed session. Order of transcript sources:
//   1. server speech-to-text (real, needs a key)   2. browser speech recognition (real, if it produced text)
//   3. demo transcript (clearly labelled, never presented as the user's words)
import { analyseAudio } from "./audio-analysis.js";
import { computeMeasures, ruleBasedTip } from "./measures.js";
import { getConfig, transcribeOnServer, requestCoachNote } from "./api.js";
import { DEMO_TRANSCRIPT } from "./content.js";
import { db, newId } from "./db.js";

export async function analyseRecording({ blob, duration, browserText, exercise, onStep }) {
  const step = (s) => onStep && onStep(s);
  const config = await getConfig();
  const notes = [];

  step("audio");
  let audio;
  try {
    audio = await analyseAudio(blob);
  } catch (e) {
    audio = { usable: false, duration, quality: [{ code: "decode", text: "The recording could not be decoded, so pause measures are unavailable." }], pauseCount: 0, longPauseCount: 0, totalPauseSeconds: 0, speakingSpan: 0, longestPause: null, pauses: [] };
  }

  step("transcript");
  let transcript = null;
  if (audio.usable && config.stt) {
    try {
      const t = await transcribeOnServer(blob);
      if (t.text) transcript = { text: t.text, words: t.words || null, source: "server", sourceLabel: t.sourceLabel || "Transcribed from your audio", real: true, language: t.language };
      else notes.push("The transcription service returned no words for this recording.");
    } catch (e) {
      notes.push(`Server transcription failed (${e.message}).`);
    }
  }
  if (!transcript && browserText && browserText.split(/\s+/).length >= 3) {
    transcript = { text: browserText, words: null, source: "browser", sourceLabel: "Transcribed by your browser's speech recognition (no word timings; fillers may be dropped)", real: true };
  }
  if (!transcript && audio.usable) {
    transcript = { text: DEMO_TRANSCRIPT, words: null, source: "demo", sourceLabel: "Demo transcript: a sample, not what you said. Pace and filler counts below describe the sample.", real: false };
    if (!config.stt) notes.push("No transcription service is configured, so a demo transcript is shown.");
  }
  if (!audio.usable) {
    transcript = null;
  }

  step("measures");
  const measures = computeMeasures({ transcript, audio });
  const tip = ruleBasedTip(measures, audio, exercise);

  return { audio, transcript, measures, tip, coach: null, notes, config };
}

// Ask the AI coach for a note. Called after the rule-based result is already on screen so the user
// never waits on a network call to see their measures.
export async function fetchCoachNote(session, previous) {
  const a = session.analysis;
  if (!a?.transcript || !a.audio?.usable) return null;
  const payload = {
    transcript: a.transcript.text,
    transcriptSource: a.transcript.sourceLabel,
    measures: publicMeasures(a.measures),
    goal: session.goalTitle || "",
    situation: session.situationTitle || "",
    exercise: session.promptText || "",
    previous: previous ? publicMeasures(previous.analysis.measures) : null,
  };
  return requestCoachNote(payload);
}

function publicMeasures(m) {
  return {
    words: m.words,
    wordsPerMinute: m.wpm,
    fillerCount: m.fillerCount,
    fillersPerMinute: m.fillersPerMin,
    fillerWords: m.fillers.slice(0, 12).map((f) => f.word),
    repeatedWords: m.repeats.slice(0, 6).map((r) => r.context.hit),
    audiblePauses: m.pauseCount,
    pausesOver2s: m.longPauseCount,
    longestPauseSeconds: m.longestPause?.duration ?? null,
    speakingSeconds: m.speakingSpan,
    transcriptIsReal: m.transcriptReal,
  };
}

export async function saveSession({ kind, title, promptText, exerciseId, parentId, blob, mimeType, duration, analysis, profile, extra }) {
  const siblings = parentId ? (await db.listSessions()).filter((s) => s.id === parentId || s.parentId === parentId) : [];
  const session = {
    id: newId(),
    createdAt: Date.now(),
    kind,
    title,
    promptText,
    exerciseId: exerciseId || null,
    parentId: parentId || null,
    attempt: parentId ? siblings.length + 1 : 1,
    audio: blob,
    mimeType,
    duration,
    goalId: profile?.goal || null,
    goalTitle: profile?.goalTitle || null,
    situationTitle: profile?.situationTitle || null,
    analysis: stripForStorage(analysis),
    ...(extra || {}),
  };
  await db.saveSession(session);
  return session;
}

function stripForStorage(a) {
  if (!a) return null;
  const { config, ...rest } = a;
  return rest;
}

// Root of a retry chain: the baseline attempt this one descends from.
export function rootOf(session, all) {
  let s = session;
  const byId = new Map(all.map((x) => [x.id, x]));
  while (s.parentId && byId.get(s.parentId)) s = byId.get(s.parentId);
  return s;
}
