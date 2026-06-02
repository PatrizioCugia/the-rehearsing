# PROJECT STATUS — The Rehearsing

Last updated: 2026-06-01, end of day.
Resume context for tomorrow's session.

---

## What exists and works end-to-end

The entire core loop is built, tested, and demo-ready:

1. **Onboarding** — user picks a preset scenario (raise / cold coffee / roommate dishes) or free-texts a custom one via a two-message chat with a scenario-composing LLM.
2. **Set image generation** — Gemini Nano Banana generates a personalized photo of you in the scenario's location (your face from reference photos in `scripts/fixtures/face/`), with a flowchart taped to the wall behind you.
3. **Webcam recording** — `getUserMedia` + `MediaRecorder`, VP9/Opus, segmented every 3s.
4. **Live streaming to Inter-1** — WebSocket to `wss://api.interhuman.ai/v1/stream/analyze`, binary frames, signals/engagement/CQI streamed back in real time.
5. **Live HUD** — signals and engagement render as they arrive on the 3s beat.
6. **Coach report** — stripped Inter-1 JSON → Claude Sonnet (persona LLM) → deadpan 2–5 sentence report.
7. **TTS voiceover** — ElevenLabs speaks the report (deadpan voice, pre-designed via Voice Design).
8. **Multi-take state** — take counter, history tracking, improvement curve (Recharts line chart, CQI + hesitation over takes).
9. **Summary screen** — final stats, curve, farewell coach line that doesn't propose another rehearsal.
10. **Graceful degradation** — every external API failure returns a canned in-register fallback line. Never crashes.

---

## File map (source only, ~2600 lines total)

### Frontend components (`components/`)
| File | Lines | What |
|---|---|---|
| `App.tsx` | 112 | Top-level state machine: onboarding → recorder → summary |
| `Onboarding.tsx` | 204 | Two-message chat + preset buttons + "composing the scene" loading beats |
| `Recorder.tsx` | 544 | Webcam, MediaRecorder, WS to Inter-1, HUD, take flow, coach/TTS calls |
| `Summary.tsx` | 160 | Final screen: scenario title, take count, curve, closing coach line |
| `Curve.tsx` | 104 | Recharts improvement chart (CQI + hesitation over takes) |
| `StreamTicker.tsx` | 91 | Live signal/engagement HUD ticker (updates on 3s beat) |
| `ProceduralBackdrop.tsx` | 136 | SVG corkboard fallback when image gen fails or MOCK_MODE is on |
| `TypedText.tsx` | 42 | Typing animation for coach report text reveal |

### Backend API routes (`app/api/`)
| File | Lines | What |
|---|---|---|
| `analyze/route.ts` | 56 | Proxy — receives recorded blob, calls Inter-1, returns signals/CQI |
| `coach/route.ts` | 188 | Calls Anthropic (Claude Sonnet) with system prompt + stripped Inter-1 payload |
| `image/route.ts` | 141 | Calls Gemini Nano Banana with face refs + scene prompt, returns data URL |
| `scenario/route.ts` | 81 | Calls Anthropic to compose a scenario from user's free-text description |
| `tts/route.ts` | 65 | Calls ElevenLabs, returns audio stream |

### Core library (`lib/`)
| File | Lines | What |
|---|---|---|
| `coach-prompt.ts` | 163 | Both system prompts (flag-off + USE_RATIONALE rich variant) + user message builder |
| `coach-payload.ts` | 122 | Strip/sanitize Inter-1 payloads for the coach (removes noise, optionally keeps rationale) |
| `stream-analyze.ts` | 130 | WebSocket client for Inter-1 streaming (binary frame send, JSON parse on receive) |
| `presets.ts` | 67 | Three pre-written preset scenarios for the demo happy path |
| `session.ts` | 69 | localStorage persistence for takes/history |
| `scenario-parse.ts` | 40 | Parse LLM scenario output (handles markdown fences, validates shape) |
| `scenario-prompt.ts` | 22 | System prompt for scenario-composing LLM |
| `curve-data.ts` | 23 | Transform take history into chart-ready data points |
| `fetch-timeout.ts` | 18 | Generic fetch-with-timeout wrapper (used for 30s demo bounds) |
| `scenario.ts` | 11 | Scenario type definition |

### Mock system (`lib/mock/`)
| File | What |
|---|---|
| `index.ts` | `isMockMode()` helper |
| `inter1.ts` | Per-take canned Inter-1 payloads (escalating CQI: 38 → 52 → 64 → 78) |
| `coach.ts` | Deterministic in-register coach lines + fallback pool |
| `scenario.ts` | Canned scenario for mock path |

### Tests (`tests/`, 27 passing)
| File | Tests | Coverage |
|---|---|---|
| `coach-payload.test.ts` | 7 | Strip logic, null handling, rationale pass-through |
| `coach-prompt.test.ts` | 6 | History injection, threshold logic, stopping mode, rationale in JSON block |
| `scenario-parse.test.ts` | 5 | Parse, fence strip, malformed rejection, fallback copy |
| `curve-data.test.ts` | 5 | Point-per-take, CQI rounding, null CQI, hesitation sum |

---

## Feature flags

| Flag | Location | Default | What |
|---|---|---|---|
| `NEXT_PUBLIC_MOCK_MODE` | `.env.local` | unset (off) | Full offline demo: canned Inter-1/coach/scenario, TTS skip, procedural backdrop |
| `USE_RATIONALE` | `.env.local` | `false` | Rich coach variant: model-distancing, mundane-quote-then-interpretation, single-detail restraint |
| `NEXT_PUBLIC_ENABLE_STREAM` | `.env.local` | `false` | Streaming ticker scaffold (not yet wired) |

---

## The coach persona — current state

Two variants, selected by `USE_RATIONALE` flag at request time:

### Flag OFF (default): `COACH_SYSTEM_PROMPT`
- Flat, deadpan, short declarative sentences
- Has NO access to rationale or probability — only signal types, timestamps, engagement, CQI
- Cannot quote user's words or describe gestures
- 2–5 sentences, escalating plans, miscalibrated reassurance

### Flag ON (rich): `COACH_SYSTEM_PROMPT_RICH`
- Same register + all rules from flag-off
- **Plus** access to rationale paragraphs and probability
- Three additional dials (added today):
  1. **Model-distancing as recurring instrument** — "I am told," "the model insists," "I have no reason to doubt the analysis" — varied, never same phrase twice per report
  2. **Mundane-quote / grand-interpretation mismatch** — quote flat ordinary words, attach disproportionate clinical weight, don't smooth the gap
  3. **Single-detail restraint** — ONE cue as centerpiece (occasionally two for contrast), resist listing, trust the silence
- Reports are SHORTER and sharper than flag-off (lean toward 2–3 sentences)

**Demo recommendation:** USE_RATIONALE=true is funnier. The model-distancing beat ("I will take the model at its word on that") consistently lands.

---

## What we did today (June 1)

### Morning: coach prompt sharpening
- Rewrote `COACH_SYSTEM_PROMPT_RICH` with the three dials above
- Replaced all three few-shot examples to demonstrate the tightened register
- Verified: 27 tests green, tsc clean, flag-off unchanged, fresh output on cold-coffee payload confirmed tighter

### Afternoon: repo push + banner
- Security audit: no secrets exposed, `.gitignore` covers all `.env*` files, scanned tracked files for key patterns
- Created GitHub repo: https://github.com/PatrizioCugia/the-rehearsal (public)
- Wrote README with: concept, why I like it, why it fits Interhuman, app architecture
- Generated poster images (Nano Banana + your face refs) in Rehearsal poster style
- Generated horizontal banners (3 variants: airplane window, airport tarmac, dark rehearsal room)
- Overlaid text with Pillow: green Georgia Bold serif "The Rehearsing" + white "AN INTERHUMAN AI PRODUCTION"
- Final banner placed in `assets/banner.jpeg`, referenced at top of README
- All pushed to GitHub

---

## Repo & deployment state

- **GitHub:** https://github.com/PatrizioCugia/the-rehearsal — up to date as of this evening
- **Branch:** `main` (only branch)
- **CI:** none configured
- **Hosting:** local dev server only (`npm run dev` on port 3000)
- **All keys in `.env.local`** (gitignored): INTERHUMAN_API_KEY, ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, GEMINI_API_KEY

---

## Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npm test           # Vitest (27 tests)
npx tsc --noEmit   # Type check
```

---

## What's left / open for tomorrow

### Must-do for demo
- [ ] Decide: `USE_RATIONALE=true` for demo? (Recommendation: yes)
- [ ] Do a full live run-through with real keys (not mock) — confirm Inter-1 → coach → TTS pipe end-to-end
- [ ] Check ElevenLabs quota/rate limits won't hit during demo
- [ ] Decide which preset to demo with (raise is most relatable, coffee is funniest)

### Nice-to-have
- [ ] Wire up `StreamTicker` live (currently scaffolded, flag-off) — show signals appearing in real time during recording
- [ ] Add a tagline/subtitle below the title in the app's onboarding screen
- [ ] Polish: maybe adjust the "analyzing..." overlay timing for more dramatic pause
- [ ] Consider: push the generated poster images to repo for social/presentation use

### Not doing
- Streaming ticker (scaffolded but not critical for demo)
- Multi-tab sync (out of scope)
- Hosting/deployment (local demo only)
- Leaderboard (not decided, not needed for demo)

---

## Architecture diagram

```
Browser                              Server (Next.js API routes)
  │                                      │
  │── WebSocket (binary video frames) ──→│ Inter-1 (wss://api.interhuman.ai)
  │←── signal/engagement/CQI JSON ──────│
  │                                      │
  │── POST /api/coach ──────────────────→│ Anthropic Claude Sonnet
  │←── { report } ─────────────────────│   (COACH_SYSTEM_PROMPT or _RICH)
  │                                      │
  │── POST /api/tts ────────────────────→│ ElevenLabs (eleven_multilingual_v2)
  │←── audio stream ───────────────────│
  │                                      │
  │── POST /api/image ──────────────────→│ Gemini Nano Banana Pro
  │←── { image: data URL } ────────────│
  │                                      │
  │── POST /api/scenario ───────────────→│ Anthropic Claude Sonnet
  │←── { scenario JSON } ──────────────│   (scenario composition)
```

---

## Key decisions made

1. **Inter-1 key exposed client-side via WS subprotocol** — acceptable for internal demo, documented in CLAUDE.md
2. **Single Next.js app, no separate backend** — fewer moving parts for a 2-day build
3. **Coach is Claude Sonnet, NOT Inter-1** — Inter-1 supplies facts, persona LLM delivers them
4. **ElevenLabs TTS server-side only** — key never hits the browser
5. **localStorage for session state** — no database, no auth, single-tab
6. **Three preset scenarios** for reproducible demo path; free-text still available
7. **30s timeouts on all external calls** — demo can't hang
8. **Every failure returns 200 with a canned in-register line** — never shows an error to the audience

---

## If you need to resume with a different AI assistant

Point them at:
1. This file (`PROJECT_STATUS.md`) for full context
2. `CLAUDE.md` for build philosophy and constraints
3. `SESSION_NOTES.md` for pre-demo hardening details
4. `DEMO_RUNBOOK.md` for the live demo playbook
5. `lib/coach-prompt.ts` for the persona engine (the creative core)
