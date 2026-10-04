# SpeakWell

A mobile-first speaking coach for professionals. Record yourself, get feedback you can check, practise again, hear the difference.

**Status: working MVP, not production-ready.** See "What still needs doing" below before putting it in front of real users.

## What it does

| Step | What happens | Real or demo without keys? |
|---|---|---|
| Onboarding | Choose a goal and a situation | Real |
| Baseline | Record an introduction or read an original passage, play it back, save it | Real |
| Daily practice | One short exercise chosen from your goal and your last measured result | Real |
| Feedback | Pauses, silence and levels measured from the audio in the browser; pace and filler words from the transcript, with quoted examples and one next step | Audio measures real. Transcript: browser speech recognition where supported, otherwise a **labelled demo sample**. Tip: rule-based |
| Retry and compare | Record again, play both attempts, see the measures side by side | Real |
| Progress | Saved sessions, delete controls, pace / fillers / pauses over time | Real |
| Role-play | A stakeholder asks why the launch slipped; record, transcribe, partner responds, three exchanges, debrief | Partner is **scripted and labelled** without an Anthropic key |

Every number on screen carries its source ("from your audio", "from transcript", "from demo transcript"). Nothing is presented as audio analysis unless it came from the audio.

## Run it

```bash
npm install
cp .env.example .env   # optional: add keys
npm start              # http://localhost:3000
```

Open on a phone on the same network over HTTPS, or use `localhost` on the desktop. Browsers only allow microphone access on `https://` or `localhost`, so for phone testing put it behind a tunnel or a reverse proxy with TLS.

Run the acceptance test (needs the server running and Chromium available to Playwright):

```bash
npm test
```

It drives the whole journey on an iPhone-sized viewport with a fake microphone: onboarding, baseline, feedback, retry, compare, delete, today's exercise, role-play, a silent take, and a denied microphone permission.

## Services and credentials

Credentials live only on the server, read from `.env`. The browser never sees them.

| Variable | Enables | Without it |
|---|---|---|
| `OPENAI_API_KEY` | Transcription with word timestamps via OpenAI Whisper. Audio is sent once when the user taps **Analyse** and is not stored by this server. | Browser speech recognition (Chrome, Edge, Safari) if the user allows it, otherwise a clearly labelled demo transcript. Pauses and timing are still measured from the real audio. |
| `ANTHROPIC_API_KEY` | AI coaching note and a role-play partner that responds to what you said (Anthropic Claude, `claude-opus-5-5` by default; refusal fallbacks requested by default). The model only sees the transcript and the measures, never the audio. | Rule-based tip chosen from the measures; scripted role-play partner that does not react to your words. |

The service badge in the top bar and the Settings screen show which services are live.

**Features that need a service to work for real:** the transcript, words per minute, filler counts, the quoted examples, the AI coaching note, and a role-play partner that reacts to your answer. Everything else (recording, playback, pauses, speaking time, levels, saving, comparing, deleting, progress) works offline from the audio alone.

## Privacy

- Recordings and feedback are stored in the browser (IndexedDB) and never uploaded unless a transcription service is configured and the user taps Analyse.
- The server keeps nothing: no database, no files, no logs of transcripts.
- Each recording has a visible delete button; Progress has "Delete all my data".
- Accent and pronunciation are not measured or judged. There is no confidence score or overall rating.

## Architecture

- `server/` Node 22 + Express, stateless. `index.js` routes, `stt.js` Whisper, `llm.js` Anthropic SDK wrapper, `coach.js` coaching note, `roleplay.js` partner (real or scripted).
- `public/` vanilla JS modules, no build step. `lib/audio-analysis.js` frame-energy pause and level detection, `lib/measures.js` transcript measures and the rule-based tip, `lib/content.js` all original exercises and passage, `lib/db.js` IndexedDB, `screens/` one file per screen.
- `tests/journey.test.mjs` Playwright acceptance run.

Dependencies: `express`, `@anthropic-ai/sdk`; `playwright` for tests only.

## What still needs doing

Before real users: HTTPS deployment, rate limiting and request size limits per client on the API routes, a privacy notice for the Whisper and browser-recognition paths, a storage quota check and export for IndexedDB, filler detection tuned on real transcripts (Whisper is prompted to keep fillers but is not consistent), real-device testing on iOS Safari (MP4 recording, audio decode) and Android Chrome, and accessibility review beyond the basics already in place.
