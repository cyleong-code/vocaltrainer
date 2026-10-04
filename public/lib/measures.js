// Transcript-based measures and the rule-based coaching tip.
// Every number here is derived from the transcript text or the audio analysis; nothing is estimated.

const CORE_FILLERS = ["um", "umm", "uh", "uhh", "er", "erm", "ah", "hmm", "mm"];
const PHRASE_FILLERS = ["you know", "i mean", "sort of", "kind of", "basically", "actually", "literally", "like"];

export function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function wordCount(text) {
  return tokenize(text).length;
}

// Finds filler words and quotes the surrounding words so the user can see each one in context.
export function findFillers(text) {
  const tokens = tokenize(text);
  const hits = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const two = i + 1 < tokens.length ? `${t} ${tokens[i + 1]}` : null;
    if (CORE_FILLERS.includes(t)) {
      hits.push({ word: t, kind: "hesitation", index: i, context: snippet(tokens, i, 1) });
    } else if (two && PHRASE_FILLERS.includes(two)) {
      hits.push({ word: two, kind: "phrase", index: i, context: snippet(tokens, i, 2) });
      i++;
    } else if (PHRASE_FILLERS.includes(t) && t !== "like") {
      hits.push({ word: t, kind: "phrase", index: i, context: snippet(tokens, i, 1) });
    } else if (t === "like" && isFillerLike(tokens, i)) {
      hits.push({ word: t, kind: "phrase", index: i, context: snippet(tokens, i, 1) });
    }
  }
  return hits;
}

// "like" is a filler when it is not acting as a verb or comparison ("I like it", "like this one").
function isFillerLike(tokens, i) {
  const prev = tokens[i - 1] || "";
  const next = tokens[i + 1] || "";
  if (["i", "we", "they", "you", "would", "d", "really", "don't", "dont", "not"].includes(prev)) return false;
  if (["this", "that", "a", "an", "the", "it", "so", "to"].includes(next)) return false;
  return true;
}

export function findRepeats(text) {
  const tokens = tokenize(text);
  const hits = [];
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] === tokens[i - 1] && tokens[i].length > 1) hits.push({ word: tokens[i], context: snippet(tokens, i - 1, 2) });
  }
  return hits;
}

function snippet(tokens, i, len) {
  const a = Math.max(0, i - 4);
  const b = Math.min(tokens.length, i + len + 4);
  const before = tokens.slice(a, i).join(" ");
  const hit = tokens.slice(i, i + len).join(" ");
  const after = tokens.slice(i + len, b).join(" ");
  return { before: (a > 0 ? "… " : "") + before, hit, after: after + (b < tokens.length ? " …" : "") };
}

export function sentenceStats(text) {
  const sentences = (text || "").split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length);
  if (!sentences.length) return null;
  const lengths = sentences.map((s) => wordCount(s));
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const longest = Math.max(...lengths);
  return { count: sentences.length, avgWords: Math.round(avg), longestWords: longest, hasPunctuation: /[.!?]/.test(text) };
}

// Combine transcript + audio into the measures the feedback screen shows.
export function computeMeasures({ transcript, audio }) {
  const words = wordCount(transcript?.text);
  const real = Boolean(transcript?.real);
  const minutes = audio?.usable && audio.speakingSpan > 0 ? audio.speakingSpan / 60 : audio?.duration ? audio.duration / 60 : 0;
  // Rates mix transcript words with audio time, so they are only meaningful when the transcript is real.
  const wpm = real && minutes > 0 && words > 0 ? Math.round(words / minutes) : null;
  const fillers = findFillers(transcript?.text);
  const repeats = findRepeats(transcript?.text);
  const fillersPerMin = real && minutes > 0 ? Math.round((fillers.length / minutes) * 10) / 10 : null;
  return {
    words,
    wpm,
    paceBand: wpm == null ? null : wpm < 115 ? "slower" : wpm > 170 ? "faster" : "within",
    fillers,
    fillerCount: fillers.length,
    fillersPerMin,
    repeats,
    sentences: sentenceStats(transcript?.text),
    pauseCount: audio?.pauseCount ?? 0,
    longPauseCount: audio?.longPauseCount ?? 0,
    longestPause: audio?.longestPause ?? null,
    totalPauseSeconds: audio?.totalPauseSeconds ?? 0,
    speakingSpan: audio?.speakingSpan ?? 0,
    duration: audio?.duration ?? 0,
    transcriptReal: Boolean(transcript?.real),
  };
}

// One improvement for the next attempt, chosen by priority from what was actually measured.
export function ruleBasedTip(measures, audio, exercise) {
  const m = measures;
  if (!audio?.usable) {
    return { nextStep: "Record again in a quiet spot with the phone about a hand's width from your mouth. The app could not detect speech this time.", observation: "No usable speech was detected, so there is nothing to coach yet.", quote: null, source: "rules", sourceLabel: "Rule-based tip (no AI service configured)" };
  }
  if (!m.transcriptReal) {
    return {
      observation: "The transcript shown is a demo sample, not your words, so pace and filler counts above describe the sample. Your pauses and timing are real.",
      nextStep: m.longPauseCount > 2 ? `You paused for 2 seconds or more ${m.longPauseCount} times. Next attempt, plan your first sentence before you press record so the opening flows.` : "Next attempt, say your main point in the first sentence, then give one reason. Keep it under 45 seconds.",
      quote: null,
      source: "rules",
      sourceLabel: "Rule-based tip (no transcription service configured)",
    };
  }
  if (m.words < 15) {
    return { observation: `Only ${m.words} words were transcribed, which is too few for a pace reading.`, nextStep: "Aim for 30 to 60 seconds of speaking. Start with the point you most want remembered.", quote: null, source: "rules", sourceLabel: "Rule-based tip" };
  }
  const f = m.fillers;
  if (m.fillersPerMin != null && m.fillersPerMin >= 4 && f.length >= 3) {
    const top = mostCommon(f.map((x) => x.word));
    return {
      observation: `${f.length} filler words in ${fmtSec(m.speakingSpan)} of speech, most often “${top}”. Fillers usually appear where the next idea is not yet decided.`,
      nextStep: `Next attempt, replace “${top}” with a silent half-second pause. Pause, then say the next word.`,
      quote: contextToString(f[0].context),
      source: "rules",
      sourceLabel: "Rule-based tip from the transcript",
    };
  }
  if (m.wpm != null && m.wpm > 175) {
    return {
      observation: `Your pace was ${m.wpm} words per minute with ${m.pauseCount} audible pauses. Fast speech is fine for familiar listeners, but it leaves little room for a point to land.`,
      nextStep: "Next attempt, finish each sentence with a full stop: close your mouth for one beat before the next sentence.",
      quote: null,
      source: "rules",
      sourceLabel: "Rule-based tip from the transcript and audio",
    };
  }
  if (m.repeats.length >= 3) {
    return {
      observation: `You restarted a word ${m.repeats.length} times, for example “${m.repeats[0].context.hit}”. Restarts often come from starting to speak before the sentence is formed.`,
      nextStep: "Next attempt, take one breath before each new sentence. Shorter sentences make restarts less likely.",
      quote: contextToString(m.repeats[0].context),
      source: "rules",
      sourceLabel: "Rule-based tip from the transcript",
    };
  }
  if (m.longestPause && m.longestPause.duration >= 3) {
    return {
      observation: `Your longest pause was ${m.longestPause.duration}s at ${fmtSec(m.longestPause.at)}. A long gap can read as hesitation unless it comes right after a key point.`,
      nextStep: "Next attempt, decide your three points before recording and name them in the first sentence so you always know what comes next.",
      quote: null,
      source: "rules",
      sourceLabel: "Rule-based tip from the audio",
    };
  }
  if (m.wpm != null && m.wpm < 110) {
    return {
      observation: `Your pace was ${m.wpm} words per minute. Measured, deliberate speech can work well, especially for difficult messages. If it felt hesitant rather than deliberate, it is worth a second take.`,
      nextStep: "Next attempt, say the same content in about 20% less time by cutting qualifiers rather than speaking faster.",
      quote: null,
      source: "rules",
      sourceLabel: "Rule-based tip from the transcript and audio",
    };
  }
  if (m.sentences?.hasPunctuation && m.sentences.longestWords > 35) {
    return {
      observation: `Your longest sentence ran to ${m.sentences.longestWords} words. Long sentences are harder to follow when spoken than when read.`,
      nextStep: "Next attempt, split any sentence with “and” or “which” into two. One idea per sentence.",
      quote: null,
      source: "rules",
      sourceLabel: "Rule-based tip from the transcript",
    };
  }
  return {
    observation: `Pace ${m.wpm} words per minute, ${m.fillerCount} filler word${m.fillerCount === 1 ? "" : "s"}, ${m.pauseCount} audible pause${m.pauseCount === 1 ? "" : "s"}. The delivery measures are steady.`,
    nextStep: exercise?.stretch || "Next attempt, cut 10 seconds without dropping the main point. Shorter is usually clearer.",
    quote: null,
    source: "rules",
    sourceLabel: "Rule-based tip from the transcript and audio",
  };
}

export function contextToString(c) {
  return `${c.before} ${c.hit} ${c.after}`.replace(/\s+/g, " ").trim();
}

function mostCommon(arr) {
  const counts = {};
  for (const a of arr) counts[a] = (counts[a] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
}

export function fmtSec(s) {
  if (s == null) return "–";
  const m = Math.floor(s / 60);
  const r = Math.round(s - m * 60);
  return m ? `${m}m ${String(r).padStart(2, "0")}s` : `${r}s`;
}

// Compare two attempts on the measures that matter. Direction says which way is "towards the goal",
// but the UI shows the raw change and lets the user judge.
export function compareAttempts(a, b) {
  const rows = [
    { key: "wpm", label: "Pace (words/min)", a: a.wpm, b: b.wpm, unit: "" },
    { key: "fillerCount", label: "Filler words", a: a.fillerCount, b: b.fillerCount, unit: "" },
    { key: "fillersPerMin", label: "Fillers per minute", a: a.fillersPerMin, b: b.fillersPerMin, unit: "" },
    { key: "pauseCount", label: "Audible pauses", a: a.pauseCount, b: b.pauseCount, unit: "" },
    { key: "longestPause", label: "Longest pause", a: a.longestPause?.duration, b: b.longestPause?.duration, unit: "s" },
    { key: "speakingSpan", label: "Speaking time", a: a.speakingSpan, b: b.speakingSpan, unit: "s" },
    { key: "words", label: "Words", a: a.words, b: b.words, unit: "" },
  ];
  return rows.map((r) => ({ ...r, delta: r.a != null && r.b != null ? Math.round((r.b - r.a) * 10) / 10 : null }));
}
