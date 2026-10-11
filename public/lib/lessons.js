// Fifteen short lessons. All text here is original. Each lesson has a plain-language note, three
// things to do, a recorded exercise, and a checklist the coach checks against the transcript.
// `measured: false` marks lessons whose skill cannot be observed from audio; they are self-check only.

export const LESSONS = [
  {
    id: "L01", n: 1, title: "The first ten seconds", topic: "First impressions", minutes: 8,
    note: [
      "People decide how carefully to listen within the first few sentences. Not from your accent or your voice, but from whether you sound like you know why you are there.",
      "A strong opening has three parts, in one breath: who you are, what you do in relation to the listener, and why you are speaking now. No apology, no “just”, no “sorry to bother you”.",
      "The most common leak is the hesitation before the first word. The app measures it as time to first word.",
    ],
    steps: ["Decide your first sentence before you press record.", "Name, role, purpose. Then stop.", "End the opening with a question or a handover so the other person knows it is their turn."],
    exercise: { prompt: "You are meeting a senior stakeholder for the first time, in a lift, with twenty seconds. Introduce yourself and say what you want from them. Finish with a question.", seconds: 20 },
    checklist: ["Name, role and purpose all appear in the first two sentences.", "No apologising or minimising words (“sorry”, “just”, “quickly”).", "Ends with a question or a clear handover."],
    measures: ["firstWord", "fillers", "pace"],
  },
  {
    id: "L02", n: 2, title: "A steady voice", topic: "Building trust with your voice", minutes: 7,
    note: [
      "Listeners trust steadiness. Steadiness is not loudness or a deep voice. It is finishing your sentences, keeping a similar pace for good news and bad news, and not trailing off.",
      "Two habits undermine it: speeding up when the content gets uncomfortable, and letting the end of a sentence rise or fade so it sounds like a question.",
      "This lesson asks you to deliver two pieces of news in the same manner. The measures show whether your pace and pauses stayed level.",
    ],
    steps: ["Say each sentence to the full stop. Do not fade.", "Keep the same pace for the pleasant and the unpleasant part.", "Pause for a beat between the two, rather than rushing into the harder one."],
    exercise: { prompt: "Give a 40-second update with one piece of good news and one piece of bad news about the same project. Deliver both in the same even manner.", seconds: 40 },
    checklist: ["Both pieces of news are stated plainly, without softening the bad one into vagueness.", "Sentences end cleanly rather than trailing into “so… yeah”.", "A pause separates the two parts."],
    measures: ["pace", "pauses", "fillers"],
  },
  {
    id: "L03", n: 3, title: "Sounding sure without bluffing", topic: "Confidence", minutes: 8,
    note: [
      "Confidence in speech is mostly the absence of hedging. “I think maybe we could possibly look at” says the same thing as “Let’s look at”, but the listener hears doubt.",
      "Sounding sure does not mean pretending to know. The confident version of uncertainty is specific: “I don’t know the number yet. I will have it by Thursday.”",
      "The app counts hedging phrases in your transcript. The aim is not zero, it is hedging only where you genuinely are unsure.",
    ],
    steps: ["Cut “I think”, “sort of”, “kind of”, “maybe”, “probably” unless you mean them.", "State what you know as fact. State what you do not know as fact too.", "Replace “I feel like” with the claim itself."],
    exercise: { prompt: "Answer out loud: “Will the project land on time?” Give what you know, what you do not, and when you will know more. 30 seconds, no hedging words unless you truly are unsure.", seconds: 30 },
    checklist: ["Known facts are stated without hedges.", "Uncertainty is named specifically, with a date or a condition.", "No more than one hedging phrase in the whole answer."],
    measures: ["hedges", "fillers", "pace"],
  },
  {
    id: "L04", n: 4, title: "Getting in and landing the point", topic: "Speaking up in meetings", minutes: 7,
    note: [
      "People who are heard in meetings do not talk more. They signpost, make one point, give one reason, and stop.",
      "The signpost is a short phrase that claims the floor: “One point on that.” “Can I add a risk?” It tells the room a contribution is coming and buys you a second to breathe.",
      "The failure mode is the add-on: making the point, then re-explaining it while people are already nodding. Stop at the full stop.",
    ],
    steps: ["Open with a signpost phrase of five words or fewer.", "One point, one reason.", "Stop. Silence after your point is not awkward; it is emphasis."],
    exercise: { prompt: "The meeting is drifting towards a decision you disagree with. In 25 seconds, claim the floor, make one point against it, give one reason, and stop.", seconds: 25 },
    checklist: ["Starts with a short signpost phrase.", "Exactly one point with one supporting reason.", "Ends without restating or softening the point."],
    measures: ["pace", "fillers", "pauses"],
  },
  {
    id: "L05", n: 5, title: "A story in four beats", topic: "Storytelling", minutes: 10,
    note: [
      "A work story is not entertainment. It is the fastest way to make a point memorable. It needs four beats: the situation, the tension, the turn, and the takeaway.",
      "Most people spend too long on the situation and skip the tension. The tension is the moment it could have gone wrong. Without it there is no story, only a report.",
      "Keep it under a minute. Say the takeaway as a single sentence the listener could repeat.",
    ],
    steps: ["Situation in two sentences, no more.", "Name the moment it nearly went wrong.", "Say the turn, then the one-sentence takeaway."],
    exercise: { prompt: "Tell a 60-second story about a time something at work nearly failed and what changed. Use the four beats: situation, tension, turn, takeaway.", seconds: 60 },
    checklist: ["The tension (what could have gone wrong) is stated explicitly.", "There is a clear turning point.", "The story ends with a one-sentence takeaway."],
    measures: ["pace", "pauses", "fillers"],
  },
  {
    id: "L06", n: 6, title: "What your body is saying", topic: "Body language", minutes: 8, measured: false,
    note: [
      "The app cannot see you, so nothing in this lesson is measured. Use it as a self-check with a mirror or your phone’s camera in another app.",
      "Three things carry most of the signal: where your weight sits, what your hands do, and where your eyes go when you think. Weight evenly on both feet reads as settled. Hands visible and still, or moving with the point, read as open. Eyes that go to the ceiling while you think are fine; eyes that drop to the floor read as retreat.",
      "The spoken exercise pairs the body check with the first-impression opening so you can practise both at once.",
    ],
    steps: ["Stand or sit with weight even, feet flat.", "Hands out of pockets and off the table edge. Let them move with the point or rest still.", "When you pause to think, look up or sideways, not down."],
    exercise: { prompt: "Stand up. Deliver your 20-second introduction from lesson 1 while watching yourself in a mirror or front camera. Then say out loud, in one sentence each: what your hands did, where your eyes went, and where your weight was.", seconds: 40 },
    checklist: ["Weight even, feet flat (self-reported).", "Hands visible and purposeful (self-reported).", "Eyes did not drop to the floor while thinking (self-reported)."],
    measures: ["firstWord", "fillers"],
  },
  {
    id: "L07", n: 7, title: "Reading the room", topic: "Reading people", minutes: 8, measured: false,
    note: [
      "Reading people is less about decoding micro-expressions and more about noticing a change and checking it. Answers get shorter. Someone stops asking questions. A pen goes down. Each is a signal that something shifted.",
      "The skill is the check: name what you noticed, neutrally, and ask. “You went quiet when I mentioned the date. Is there a concern there?” Done well it feels like attention, not interrogation.",
      "The app cannot observe other people, so this lesson is practised as phrasing: three check-in lines said aloud until they sound natural.",
    ],
    steps: ["Notice one concrete change, not a mood.", "Name it as an observation, not a diagnosis.", "Ask one open question and wait."],
    exercise: { prompt: "Say three check-in lines aloud, as if to a colleague across the table, each for a different signal: they went quiet; they gave a one-word answer; they looked at the clock. Each line: the observation, then one open question.", seconds: 30 },
    checklist: ["Each line names a specific, observable change.", "Each line ends with an open question rather than a yes/no.", "Tone stays neutral; no “you seem annoyed”."],
    measures: ["pace", "pauses"],
  },
  {
    id: "L08", n: 8, title: "Feedback in four sentences", topic: "Giving tough feedback", minutes: 9,
    note: [
      "Hard feedback becomes easier to give and to hear when it is short. Four sentences: what you observed, the effect it had, what you want instead, and a question that hands the conversation over.",
      "The observation must be something a camera would have seen. “You interrupted Mei three times in the review” lands; “you were disrespectful” starts an argument.",
      "Most people pad the beginning with reassurance and the end with apology. Cut both. The structure is the kindness.",
    ],
    steps: ["Observation a camera could have recorded.", "Impact in one sentence.", "Request, then a question, then silence."],
    exercise: { prompt: "A colleague sent a client an email with wrong numbers for the second time this month. Give them the feedback in four sentences: observation, impact, request, question. 30 seconds.", seconds: 30 },
    checklist: ["Opens with a concrete observation, no character judgement.", "States the impact in one sentence.", "Ends with a specific request followed by a question."],
    measures: ["pace", "hedges", "fillers"],
  },
  {
    id: "L09", n: 9, title: "Staying level", topic: "Handling difficult people", minutes: 8,
    note: [
      "With a difficult person, your pace is the tell. When they push, most people speed up and explain more. The person who stays level slows down and says less.",
      "The pattern is acknowledge, boundary, redirect. Acknowledge the content, not the tone. State the boundary in one sentence. Redirect to the next useful step.",
      "The app compares your pace in this exercise with your baseline. The aim is the same or slower, not faster.",
    ],
    steps: ["Acknowledge what they said in one neutral sentence.", "State one boundary plainly, without justifying it.", "Redirect to a concrete next step."],
    exercise: { prompt: "Someone interrupts your update with: “This is a waste of time, none of this will work.” Reply in 25 seconds: acknowledge, boundary, redirect. Keep your pace steady or slower than usual.", seconds: 25 },
    checklist: ["Acknowledges the point without agreeing or arguing.", "One clear boundary sentence.", "Ends by naming the next step."],
    measures: ["pace", "pauses", "fillers"],
  },
  {
    id: "L10", n: 10, title: "A clear no", topic: "Saying no and staying liked", minutes: 7,
    note: [
      "A no that keeps the relationship has three parts: appreciation that is specific, the no with a short reason, and an alternative. The alternative is what makes it feel like help rather than refusal.",
      "The reason should be one sentence. A long reason invites negotiation. A missing reason feels like a brush-off.",
      "Watch for the soft no: “I’ll see what I can do.” It sounds kind and creates a bigger problem next week.",
    ],
    steps: ["Thank them for something specific about the ask.", "Say no and give one reason.", "Offer one alternative or a smaller yes."],
    exercise: { prompt: "A peer asks you to join a working group that meets every Friday afternoon. You cannot. Say no in 25 seconds: specific appreciation, no with one reason, one alternative.", seconds: 25 },
    checklist: ["The word “no” or an unmistakable equivalent is actually said.", "Exactly one reason.", "An alternative is offered."],
    measures: ["hedges", "fillers", "pace"],
  },
  {
    id: "L11", n: 11, title: "Cutting in without cutting down", topic: "Interrupting smoothly", minutes: 7,
    note: [
      "Sometimes you must interrupt: the meeting is over time, the speaker has the facts wrong, or the decision is about to go the wrong way. Done well it feels like steering, not seizing.",
      "The method is name, bridge, brevity. Use their name, which stops most people mid-sentence without offence. Bridge with a phrase that honours what they were saying. Then be brief, so the floor returns quickly.",
      "Pace matters here. An interruption delivered fast sounds like a grab. Delivered at an even pace, it sounds like a chair.",
    ],
    steps: ["Say their name first, on its own.", "Bridge: “before we move on” or “building on that”.", "Say the one thing, then hand back."],
    exercise: { prompt: "A colleague, Sam, is five minutes into a detour and the meeting ends in two minutes. Interrupt in 15 seconds: name, bridge, the one thing that must be decided, hand back.", seconds: 15 },
    checklist: ["Opens with the person’s name.", "Includes a bridging phrase before the point.", "Under 15 seconds and hands the floor back."],
    measures: ["pace", "fillers", "firstWord"],
  },
  {
    id: "L12", n: 12, title: "Lowering the temperature", topic: "Defusing conflict", minutes: 9,
    note: [
      "Conflict escalates on speed and volume. The person who lowers the temperature slows their pace, names the shared goal, and asks one question instead of making one more point.",
      "Naming the shared goal is the move people skip. “We both want this launched without a repeat of March” gives the other person something to agree with before anything else.",
      "Your pace in this exercise is compared with your baseline. Slower is the goal.",
    ],
    steps: ["Slow down. Longer pauses, shorter sentences.", "Name the goal you both share, in one sentence.", "Ask one genuine question and let them answer."],
    exercise: { prompt: "Two teams are blaming each other for a missed deadline, and you are in the middle. Speak for 30 seconds to lower the temperature: name the shared goal, then ask one question. Pace slower than normal.", seconds: 30 },
    checklist: ["A shared goal is named explicitly.", "Ends with one open question.", "No blame, no “but”."],
    measures: ["pace", "pauses", "hedges"],
  },
  {
    id: "L13", n: 13, title: "Proving you listened", topic: "Listening like a leader", minutes: 7,
    note: [
      "Listening is invisible until you prove it. The proof is a one-sentence reflection before you reply: what they said, in your words, including the feeling if there was one.",
      "It costs five seconds and changes the whole exchange. People who feel heard argue less and disclose more.",
      "The trap is reflecting back then saying “but”. The reflection must stand alone for a beat before your view arrives.",
    ],
    steps: ["Reflect their point in one sentence, in your words.", "Check: “Is that right?” and pause.", "Only then give your view."],
    exercise: { prompt: "Imagine a team member just told you: “I’m doing the work of two people since Ana left and nobody has noticed.” Reply in 25 seconds: reflect in one sentence, check, pause, then respond.", seconds: 25 },
    checklist: ["First sentence restates their point, not yours.", "A check question (“is that right?”) and a pause follow it.", "Your own view comes last, without “but”."],
    measures: ["pauses", "pace", "fillers"],
  },
  {
    id: "L14", n: 14, title: "Easy openers", topic: "Small talk", minutes: 7,
    note: [
      "Small talk is not about being interesting. It is about making the other person comfortable enough to talk. Three kinds of opener do most of the work: the shared situation, the easy opinion, and the follow-up.",
      "Shared situation: something you both can see or are both doing. Easy opinion: a low-stakes question that invites a view. Follow-up: a second question about their answer, which is where real conversation starts.",
      "The measurable part is fluency: fewer fillers and no long gaps while you search for the next thing to say.",
    ],
    steps: ["Open with something you both share right now.", "Ask for an easy opinion, not a fact.", "Ask one follow-up about whatever they said."],
    exercise: { prompt: "You are at a conference coffee break next to someone you do not know. Speak your side of 30 seconds of small talk: a shared-situation opener, an easy-opinion question, and a follow-up question. Leave gaps where they would answer.", seconds: 30 },
    checklist: ["Opener refers to the shared situation.", "At least one question asks for an opinion rather than a fact.", "A follow-up question builds on an imagined answer."],
    measures: ["fillers", "pauses", "pace"],
  },
  {
    id: "L15", n: 15, title: "Pause on purpose", topic: "The power of a pause", minutes: 8,
    note: [
      "A pause does three jobs: it lets a point land, it replaces a filler word, and it signals that you are not in a hurry. Most speakers pause less than they think they do.",
      "Two placements matter most: the pause before the key sentence, which makes people lean in, and the pause after a question, which makes people answer.",
      "The app counts audible pauses of 0.6 seconds or longer and shows your longest. For this exercise, aim for several deliberate pauses of a full second.",
    ],
    steps: ["Choose one sentence that matters most.", "Pause for a full second before it, and again after it.", "Replace every filler with silence."],
    exercise: { prompt: "Give a 40-second update on anything. Pick one key sentence. Pause for a full second before and after it. Everywhere you would normally say “um”, say nothing.", seconds: 40 },
    checklist: ["A clear pause precedes the key sentence.", "A clear pause follows it.", "Fillers are replaced by silence rather than words."],
    measures: ["pauses", "fillers", "pace"],
  },
];

export function lessonById(id) {
  return LESSONS.find((l) => l.id === id) || null;
}

// Next lesson: the first one without a saved session. Goal-based nudges reorder the first pick only.
export function nextLesson(sessions, goalId) {
  const done = new Set(sessions.filter((s) => s.lessonId).map((s) => s.lessonId));
  if (!done.size) {
    const first = { fillers: "L15", pace: "L15", pressure: "L09", clear: "L01" }[goalId];
    if (first) return lessonById(first);
  }
  return LESSONS.find((l) => !done.has(l.id)) || null;
}

export const MEASURE_LABELS = {
  pace: "pace (words per minute)",
  pauses: "audible pauses",
  fillers: "filler words",
  hedges: "hedging phrases",
  firstWord: "time to first word",
};
