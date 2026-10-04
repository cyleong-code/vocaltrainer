// All exercise content here is original. Written in plain language for working professionals.

export const GOALS = [
  { id: "clear", title: "Make my point clearly", blurb: "Lead with the message, keep sentences short." },
  { id: "fillers", title: "Cut filler words", blurb: "Fewer ums, uhs and you-knows; more silence." },
  { id: "pace", title: "Control my pace", blurb: "Slow down under pressure, pause on purpose." },
  { id: "pressure", title: "Stay composed under questioning", blurb: "Answer hard questions without rushing or rambling." },
];

export const SITUATIONS = [
  { id: "presentation", title: "Presentation", blurb: "Updates, pitches, all-hands." },
  { id: "meeting", title: "Meeting", blurb: "Making a point in a group." },
  { id: "interview", title: "Interview", blurb: "Answering about your experience." },
  { id: "difficult", title: "Difficult conversation", blurb: "Feedback, pushback, bad news." },
];

export const BASELINE = {
  intro: {
    title: "Introduce yourself",
    prompt: "In about 45 seconds: who you are, what you work on, and one thing you are trying to get better at this quarter. Speak as if to a new colleague.",
    seconds: 45,
  },
  passage: {
    title: "Read a short passage",
    prompt: "Read this aloud at the pace you would use in a meeting.",
    text:
      "Every Thursday the delivery van arrived ten minutes late, and every Thursday we blamed the traffic. Last month someone finally checked. The route had not changed in two years, but the loading bay opened at nine and the driver was booked for five to nine. We moved the booking by fifteen minutes. The van has been on time ever since. Most problems in our team look like this: not a question of effort, but of nobody having looked closely at the one small thing that sets everything else in motion.",
    seconds: 40,
  },
};

// Exercises are keyed by goal. Each has a prompt the user speaks to, a target length, and a
// "stretch" tip used when the measures look steady.
export const EXERCISES = {
  clear: [
    { id: "clear-1", title: "Headline first", prompt: "Pick a project you are working on. Say the single most important thing about it in one sentence. Then give two reasons it matters. Then stop.", seconds: 40, stretch: "Next attempt, say the headline sentence in under eight words." },
    { id: "clear-2", title: "Explain it to a newcomer", prompt: "Explain what your team does to someone who joined the company today. No acronyms. Finish with what success looks like this year.", seconds: 60, stretch: "Next attempt, remove every acronym and every word ending in “-isation”." },
    { id: "clear-3", title: "Three-part answer", prompt: "Answer this question out loud: “What should we do differently next quarter?” Use exactly three points and number them as you go.", seconds: 50, stretch: "Next attempt, give each of the three points in one sentence each." },
  ],
  fillers: [
    { id: "fill-1", title: "Pause instead", prompt: "Describe your journey to work this morning in detail. Whenever you feel a filler word coming, stop and stay silent for one full second instead.", seconds: 45, stretch: "Next attempt, make every pause at least one second long. Silence is allowed." },
    { id: "fill-2", title: "Slow start", prompt: "Explain a decision you made recently and why. Before you begin, think of your first sentence completely, then press record.", seconds: 45, stretch: "Next attempt, plan the first and last sentence before recording." },
    { id: "fill-3", title: "Unfamiliar topic", prompt: "Talk for 40 seconds about how a vending machine works. When you reach a gap in your knowledge, pause rather than fill it.", seconds: 40, stretch: "Next attempt, pick an even less familiar topic and keep the pauses silent." },
  ],
  pace: [
    { id: "pace-1", title: "Full stops", prompt: "Describe a product or service you use often. End every sentence with a clear full stop: close your mouth, breathe, then continue.", seconds: 45, stretch: "Next attempt, count to one in your head at each full stop." },
    { id: "pace-2", title: "Landing the key line", prompt: "Give a 40-second update on anything. Choose one sentence that matters most and say it noticeably slower than the rest, with a pause before and after.", seconds: 40, stretch: "Next attempt, make the pause before the key line two seconds long." },
    { id: "pace-3", title: "Under time pressure", prompt: "Imagine you have been told you have 30 seconds, not five minutes. Give the essential version of your current project update without speeding up.", seconds: 30, stretch: "Next attempt, cut another five seconds by removing words, not by speaking faster." },
  ],
  pressure: [
    { id: "press-1", title: "Buy a second", prompt: "Answer this question out loud: “Why did your last project take longer than planned?” Start your answer by restating the question in your own words, then answer in three sentences.", seconds: 40, stretch: "Next attempt, pause for a full breath before your first word." },
    { id: "press-2", title: "Say what you do not know", prompt: "Answer this: “What will revenue be next quarter?” Give what you do know, name what you do not, and say when you will know it. No hedging words.", seconds: 40, stretch: "Next attempt, remove “I think”, “probably” and “sort of” entirely." },
    { id: "press-3", title: "Hold the point", prompt: "Someone says: “That plan will never work here.” Reply calmly. Acknowledge the concern in one sentence, then give one reason you still back the plan.", seconds: 35, stretch: "Next attempt, make the acknowledgement genuinely specific to the concern." },
  ],
};

// Daily exercise: pick by goal, rotate by day, and steer towards what the last analysis showed.
export function pickDailyExercise(goalId, lastMeasures, dayIndex = Math.floor(Date.now() / 86400000)) {
  let pool = EXERCISES[goalId] || EXERCISES.clear;
  if (lastMeasures?.transcriptReal) {
    if (lastMeasures.fillersPerMin >= 4) pool = EXERCISES.fillers;
    else if (lastMeasures.wpm > 175) pool = EXERCISES.pace;
  }
  return pool[dayIndex % pool.length];
}

export function goalById(id) {
  return GOALS.find((g) => g.id === id) || null;
}
export function situationById(id) {
  return SITUATIONS.find((s) => s.id === id) || null;
}

// Shown only when no transcription is available. Always labelled as a demo transcript in the UI.
export const DEMO_TRANSCRIPT =
  "So, um, I'm leading the checkout redesign and, uh, the main thing I want to say is that we are three weeks behind. Basically the payment provider changed their, their API in August and we didn't catch it until testing. Um, the new date is the fourteenth and I'm, you know, fairly confident in it because the fix is already in review. What changes going forward is that we, uh, we add a weekly check on vendor changelogs so nothing surprises us like this again.";

export const ROLEPLAY = {
  id: "launch-slip",
  title: "Stakeholder asks why the launch slipped",
  setting: "Your commercial director, Dana, has asked for five minutes. A launch you own has moved back three weeks. Dana is direct, fair, and will push on vague answers.",
  opening: "Thanks for making time. I saw the launch date moved by three weeks. Walk me through what happened.",
  turns: 3,
  tips: ["Reason, then new date, then what changes.", "One breath before you answer.", "It is fine to say what you do not know yet."],
};
