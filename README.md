# The Rehearsing

> **An affectionate homage.** This project is heavily inspired by *The Rehearsal*, the HBO series created by Nathan Fielder, and its premise of rehearsing trivial life moments with absurd, obsessive rigor. We borrow that spirit — the deadpan tone, the over-prepared staging, the gravity applied to nothing — as a tribute. The coach's voice and persona here are original, not an impersonation, and this project is an independent, unaffiliated fan homage, not associated with or endorsed by Nathan Fielder or HBO.

## The Concept

You pick a mundane social interaction — returning a cold coffee, asking your roommate to do the dishes, ending things with your hairdresser — and rehearse it on webcam as if it were a hostage negotiation. The app watches you through Interhuman's Inter-1 behavioral model, then a clinical, humorless AI coach delivers a formal Rehearsal Report over the footage of your performance. It takes the task extremely seriously. The task does not warrant it.

The conceit is lifted, lovingly, from *The Rehearsal*: the idea that any small interaction can — and perhaps should — be practiced exhaustively, with flowcharts, role-play, and a calm refusal to acknowledge how strange this is. Where the show uses elaborate physical sets and actors, we use a behavioral AI model and a deadpan coach.

Multiple takes. A take counter. An improvement curve. The coach proposes escalating, faintly unhinged follow-up plans ("we will go again, and this time I will play the barista myself") as if this is obviously the reasonable next step.

The whole thing is a toy. It is meant to be funny.

## Why I Like It So Much

The comedy lives in the gap between register and stakes. The model gives you a clinical behavioral readout — confidence probability high, hesitation at second eleven, engagement state neutral — and the coach relays these findings with the gravity of a post-surgery debrief. About a coffee.

The best version of this picks ONE quietly humiliating detail from the model's analysis, quotes your actual mundane words back at you, attaches a disproportionate clinical interpretation, and stops. The silence does the work. The coach trusts the instrument and quietly declines to take personal responsibility for what it reports ("I will take the model at its word on that"). It believes it is helping.

It's the register-to-stakes mismatch that makes it land — a tone borrowed from sports psychology, clinical observation, and one very particular HBO series — applied to whether you successfully told someone their latte was cold.

## Why It Fits Interhuman's API

Inter-1 does something no other model does: it reads real-time behavioral signals from video. Agreement, hesitation, stress, confidence — with timestamps, probabilities, and rationale paragraphs explaining what it observed. It's built for serious applications (sales coaching, therapy analysis, interview prep).

The Rehearsal uses this capability at full power, on interactions that are maximally trivial. The API is doing exactly what it was designed to do. The comedy comes from the context, not from misuse. This showcases Inter-1's streaming WebSocket integration, its signal vocabulary, its engagement tracking, and its conversation quality index — all in a live demo that makes people laugh.

The technical integration is real:

- Live WebSocket streaming of webcam video to `wss://api.interhuman.ai/v1/stream/analyze`
- 3-second segment capture with MediaRecorder (VP9/Opus)
- Real-time HUD rendering signals and engagement as they arrive
- Full CQI (Conversation Quality Index) tracking across takes
- Rationale-aware coaching that cites the model's specific observations

## The App: What We Built and How

### Stack

- Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui
- Browser webcam capture via `getUserMedia` + `MediaRecorder`, streamed live to Inter-1 over WebSocket
- Next.js API routes as backend proxy (ElevenLabs TTS, Anthropic persona LLM) — keys stay server-side
- React state + localStorage for multi-take persistence

### Architecture

```
Browser                          Server
  |                                |
  |-- WebSocket (binary frames) -->| Inter-1 (wss://api.interhuman.ai)
  |<-- signal/engagement/CQI JSON--|
  |                                |
  |-- POST /api/coach ------------>| Anthropic (Claude Sonnet) -- persona LLM
  |<-- { report } ----------------|
  |                                |
  |-- POST /api/tts -------------->| ElevenLabs -- deadpan voice
  |<-- audio stream ---------------|
```

### The Core Loop

1. User picks a scenario (absurd-mundane seed list)
2. Webcam streams to Inter-1 → live HUD shows signals + engagement updating on the 3-second segment beat
3. On stop: stripped Inter-1 JSON → persona LLM → deadpan Rehearsal Report
4. ElevenLabs TTS speaks the report over the replay (documentary-over-footage)
5. "Rehearse again" → take counter increments → improvement curve (CQI tracking across takes)

### The Persona Engine

The coach is a second LLM (Claude Sonnet) that narrates Inter-1's output in a flat, deadpan register — a tone inspired by *The Rehearsal*, but written as an original persona rather than an impersonation of anyone. Inter-1 supplies clinical facts; the persona delivers them. The system prompt enforces:

- Treat trivial interactions as grave. Never acknowledge the mismatch.
- Model-distancing: relay findings as reported by an instrument, declining personal responsibility.
- Single-detail restraint: one precise observation, stated flat, trusting the silence.
- Mundane-quote / grand-interpretation: quote their ordinary words, attach disproportionate clinical weight.
- Escalating rehearsal plans presented as obviously reasonable.
- 2–5 short sentences max. Lean short.

## Running Locally

```bash
cp .env.example .env.local
# Fill in: INTERHUMAN_API_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
npm install
npm run dev
```

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `INTERHUMAN_API_KEY` | Client (WS subprotocol) | Inter-1 streaming auth |
| `ANTHROPIC_API_KEY` | Server only | Persona LLM (coach) |
| `ELEVENLABS_API_KEY` | Server only | TTS voice synthesis |
| `ELEVENLABS_VOICE_ID` | Server only | Pre-designed deadpan voice |
| `USE_RATIONALE` | Server only | Enable rationale-aware coach (true/false) |

## Acknowledgments

Made with deep admiration for *The Rehearsal* (HBO) and Nathan Fielder, whose commitment to rehearsing the unrehearsable made the whole genre of comedy this borrows from. This is an independent fan homage, built for an internal hackathon, and is not affiliated with, sponsored by, or endorsed by Nathan Fielder or HBO.
