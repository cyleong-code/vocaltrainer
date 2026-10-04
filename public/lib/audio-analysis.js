// Measures taken directly from the recorded audio, in the browser. No model involved, so these
// are always real for the recording shown. Frame-energy based: works for any language or accent.

const FRAME_MS = 40;
const MIN_PAUSE_S = 0.6; // a gap long enough to be heard as a pause in speech
const LONG_PAUSE_S = 2.0;

export async function analyseAudio(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  let audio;
  try {
    const buf = await blob.arrayBuffer();
    audio = await ctx.decodeAudioData(buf);
  } catch (e) {
    await ctx.close().catch(() => {});
    const err = new Error("Could not decode the recording.");
    err.code = "decode";
    throw err;
  }
  await ctx.close().catch(() => {});

  const sr = audio.sampleRate;
  const mono = mixDown(audio);
  const frameLen = Math.max(1, Math.round((sr * FRAME_MS) / 1000));
  const frames = [];
  let peak = 0;
  let clipped = 0;
  for (let i = 0; i + frameLen <= mono.length; i += frameLen) {
    let sum = 0;
    for (let j = i; j < i + frameLen; j++) {
      const v = mono[j];
      sum += v * v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
      if (a > 0.985) clipped++;
    }
    frames.push(Math.sqrt(sum / frameLen));
  }
  const duration = audio.duration;
  if (!frames.length) return emptyResult(duration);

  // Noise floor: the 20th percentile of frame energy. Speech threshold sits well above it.
  const sorted = [...frames].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.2)] || 1e-6;
  const loud = sorted[Math.floor(sorted.length * 0.95)] || floor;
  const threshold = Math.max(floor * 3, 0.004, floor + (loud - floor) * 0.12);
  const voiced = frames.map((f) => f > threshold);

  const voicedCount = voiced.filter(Boolean).length;
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : -100;
  const speechFrac = voicedCount / frames.length;

  let first = voiced.indexOf(true);
  let last = voiced.lastIndexOf(true);
  const quality = [];
  if (duration < 3) quality.push({ code: "short", text: "The recording is under 3 seconds, so pace and pause measures are not reliable." });
  if (first === -1 || peakDb < -40 || voicedCount < 5) {
    quality.push({ code: "silent", text: "Little or no speech was detected. Check the microphone and that nothing is muted, then record again." });
    return { ...emptyResult(duration), peakDb, quality, usable: false };
  }
  if (peakDb < -24) quality.push({ code: "quiet", text: "The recording is quiet. Move closer to the microphone for a cleaner reading." });
  if (clipped > frames.length * frameLen * 0.002) quality.push({ code: "clipping", text: "Parts of the recording are distorted (clipping). Lower the input level or move back slightly." });
  if (loud / floor < 2.5) quality.push({ code: "noisy", text: "Background noise is close to your speaking level. A quieter room will make the pause measures more accurate." });

  // Pauses: runs of unvoiced frames between the first and last speech, longer than MIN_PAUSE_S.
  const pauses = [];
  let runStart = -1;
  for (let i = first; i <= last; i++) {
    if (!voiced[i]) {
      if (runStart === -1) runStart = i;
    } else if (runStart !== -1) {
      const len = ((i - runStart) * FRAME_MS) / 1000;
      if (len >= MIN_PAUSE_S) pauses.push({ start: (runStart * FRAME_MS) / 1000, duration: Math.round(len * 100) / 100 });
      runStart = -1;
    }
  }
  const speakingSpan = ((last - first + 1) * FRAME_MS) / 1000;
  const totalPause = pauses.reduce((a, p) => a + p.duration, 0);
  const longest = pauses.reduce((m, p) => (p.duration > m.duration ? p : m), { duration: 0, start: 0 });
  const leadSilence = (first * FRAME_MS) / 1000;
  const trailSilence = duration - ((last + 1) * FRAME_MS) / 1000;

  return {
    usable: true,
    duration: round(duration),
    speakingSpan: round(speakingSpan),
    leadSilence: round(leadSilence),
    trailSilence: round(trailSilence),
    speechFraction: round(speechFrac),
    pauseCount: pauses.length,
    longPauseCount: pauses.filter((p) => p.duration >= LONG_PAUSE_S).length,
    totalPauseSeconds: round(totalPause),
    longestPause: { duration: round(longest.duration), at: round(longest.start) },
    pauses,
    peakDb: round(peakDb),
    quality,
    source: "Measured from the audio in your browser",
  };
}

function mixDown(audio) {
  if (audio.numberOfChannels === 1) return audio.getChannelData(0);
  const out = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const d = audio.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] += d[i] / audio.numberOfChannels;
  }
  return out;
}

function emptyResult(duration) {
  return {
    usable: false,
    duration: round(duration),
    speakingSpan: 0,
    leadSilence: 0,
    trailSilence: 0,
    speechFraction: 0,
    pauseCount: 0,
    longPauseCount: 0,
    totalPauseSeconds: 0,
    longestPause: { duration: 0, at: 0 },
    pauses: [],
    peakDb: -100,
    quality: [],
    source: "Measured from the audio in your browser",
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}
