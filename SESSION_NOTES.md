# SESSION_NOTES — Pre-Demo Hardening

Built while you slept. Date: 2026-06-01 (continued).

## TL;DR

Tasks 1–5 from the hardening prompt are in. The entire app is now dry-runnable end-to-end without any external key via `NEXT_PUBLIC_MOCK_MODE=true`. Behavior is locked behind 21 Vitest tests. Every external failure path returns a canned in-register coach line, not an error. The full headless verification is green:

- `tsc --noEmit` — clean
- `npm run lint` — clean
- `npm test` — **21 tests passing across 4 files (131ms)**
- Dev boots, `GET /` → 200
- MOCK_MODE: every API short-circuits correctly (verified live)
- Coach forced-fail returns the fallback line, not 5xx

**Image pillar is LIVE again.** You swapped the working Gemini key back in this morning, so I switched [app/api/image/route.ts](app/api/image/route.ts) back to `nano-banana-pro-preview` and generated two real images for you: [scripts/out/test-bar.png](scripts/out/test-bar.png) and [scripts/out/test-office.png](scripts/out/test-office.png). Both look correct — your face, deadpan, hand-drawn flowchart taped behind you, laptop on a folding table, neutral wardrobe consistent across both.

## Commits this session

| Commit | What |
|---|---|
| `5885284` | Switched image route back to Gemini Nano Banana Pro, verified with bar + office shots. |
| `1f5b94f` | **Task 1.** MOCK_MODE. Canned per-take Inter-1 payloads, deterministic scenario, deterministic coach lines, TTS skip, procedural SVG backdrop. Single flag (`NEXT_PUBLIC_MOCK_MODE`), single injection point ([lib/mock/](lib/mock/)). |
| `f5ce6b1` | **Tasks 2 + 3.** Vitest with 21 tests covering the strip, history pass-through, threshold, scenario parse, curve transform. Coach fallback lines + every failure path returns 200 with canned in-register text. |
| `15e23d4` | **Task 4.** Image and scenario fetches bounded by 30 s timeout — onboarding can no longer hang the demo if Gemini or Anthropic is slow. |
| `2ce8d20` | **Task 5.** Three preset deadpan scenarios (raise / cold coffee / roommate dishes) selectable in onboarding, alongside the free-text path. |

## How to dry-run the full demo flow tomorrow (no keys needed)

This is the most important section. Set the flag, boot the dev server, walk through it:

```
cd "/Users/patrizio/Desktop/internal challenge"
# 1) Set the flag (edit .env.local)
#    NEXT_PUBLIC_MOCK_MODE=true
npm run dev
# open http://localhost:3000 in Chrome
```

### What you should see, in order:

1. **Onboarding** — Q1 "Where does this rehearsal take place." appears as a coach bubble. Below the input, **three preset buttons** ("Asking your manager for a raise.", "Returning a cold coffee.", "Telling your roommate to do the dishes.")
2. **Pick the path you want to demo:**
   - **Free-text path:** type a location → Q2 appears → type yourself + scenario → cycling beats ("Composing the scene." → "Constructing the set." → "Reviewing the materials.") → lands in the recorder.
   - **Preset path:** click a preset button → cycling beats → lands in the recorder with the preset's title, framing, and scene-partner line baked in. **Use this for the live demo.**
3. **Recorder:** the left "set image" card shows the **procedural backdrop** — black background with index cards labeled `OPENING`, `PAUSE`, `RESPONSE A/B`, `REBUTTAL`, `FALLBACK`, `EXIT`, connected by dotted lines. A "MOCK SET — [title]" caption sits along the bottom. It looks intentional.
4. **Webcam preview** on the right after permission. (Mock mode does NOT skip the webcam — you still need to grant camera access; the recording itself happens, just no upload to Inter-1.)
5. **Take 1:** Begin → record ≥ 3 s → End. Beats run: Analyzing → Composing → Voicing. Mock returns Inter-1 take 1: CQI **38**, hesitation 2.1–7.4 s, uncertainty 9.0–13.2 s, stress 15.5–19.1 s. Coach line will reference this. Audio is skipped in mock mode (TTS returns 503), so the report text is just shown — no voice.
6. **Take 2:** "Rehearse again" → record → End. Mock returns Inter-1 take 2: CQI **52**, less hesitation. **The improvement curve appears at the bottom** (it only renders for ≥ 2 takes). CQI line should go 38 → 52.
7. **Take 3:** CQI **64**, confidence appears.
8. **Take 4:** CQI **78** — **threshold crossed**. The "Stop here" button label flips to "Stop here. You may." Coach line should soften ("By the standard I set for myself this morning, that is adequate. You may stop here…")
9. **Quit:** Click "Stop here. You may." → Summary screen.
10. **Summary:** scenario title + "You completed 4 rehearsals." + procedural backdrop again + the improvement curve (now with 4 points) + a final coach line that **does not propose another rehearsal** but acknowledges you could have continued.
11. **"Begin a new scenario"** → clears localStorage → back to onboarding.

### Mock-mode arc the coach references

The per-take canned payloads are tuned so the cross-take callbacks are demonstrable:

| Take | CQI overall | Signals | Engagement |
|---|---|---|---|
| 1 | 38 | hesitation, uncertainty, stress | neutral |
| 2 | 52 | hesitation, uncertainty | neutral |
| 3 | 64 | hesitation, confidence | neutral → engaged |
| 4 | 78 ← threshold | confidence, agreement, hesitation | engaged |
| 5+ | ~85 | confidence, agreement | engaged |

### What still needs real keys vs. fully mocked

| Pillar | Mocked? | Notes |
|---|---|---|
| Webcam capture | ❌ Real | Always real. Browser permission required. |
| `/api/analyze` (Inter-1) | ✅ Mocked | Returns canned per-take payload. |
| `/api/coach` (Anthropic) | ✅ Mocked | Returns deterministic in-register line. |
| `/api/scenario` (Anthropic) | ✅ Mocked | Returns canned scenario with location interpolated. |
| `/api/tts` (ElevenLabs) | ✅ Skipped | Returns 503; client shows report text without voice. |
| `/api/image` (Gemini) | ✅ Stubbed | Returns `{image: null, procedural: true}`; client renders ProceduralBackdrop. |

To dry-run **with full audio**, leave MOCK_MODE off and just hit ElevenLabs + Anthropic live. To dry-run **completely offline**, MOCK_MODE on. Both paths work.

### Image gen — LIVE, USE IT FOR DEMO

`GEMINI_API_KEY` is back in `.env.local` and `/api/image` is pointed at `nano-banana-pro-preview`. With MOCK_MODE off, the onboarding will actually generate a personalised set image of you. Two sample outputs in `scripts/out/` confirm it works — the bar shot has charmingly-broken handwriting in the flowchart, the office shot has perfectly-legible text. **Both are on-brand.** Whatever it returns, ship.

## What's locked behind tests (21 total)

[tests/coach-payload.test.ts](tests/coach-payload.test.ts) — 7 tests
- Signals get stripped to `{type, start, end}` only — rationale/probability/extra fields gone
- `engagement_state` windows get stripped to `{state, start, end}` only
- `conversation_quality` block survives intact
- Strip handles null/undefined/empty/non-array input without throwing
- Same guarantees applied to every entry in `history`

[tests/coach-prompt.test.ts](tests/coach-prompt.test.ts) — 6 tests
- **History pass-through (the stale-closure regression):** on take N, exactly N-1 prior takes appear in the prompt, indexed 1..N-1, no phantoms
- The full payload appears as a JSON block
- Threshold note ("personal threshold of 75", "could stop here") appears when CQI ≥ 75
- Threshold note does NOT appear when CQI < threshold
- Stopping mode adds "The person has chosen to stop" + "Do not propose another rehearsal"
- Stopping mode does NOT also stack the threshold note

[tests/scenario-parse.test.ts](tests/scenario-parse.test.ts) — 5 tests
- Valid JSON parses to `{title, scenePartnerLine, framing}`
- `\`\`\`json ... \`\`\`` code fences are stripped before parsing
- Malformed JSON returns null
- Missing required fields returns null
- Fallback scenario copy is in register (no exclamation marks, no emoji)

[tests/curve-data.test.ts](tests/curve-data.test.ts) — 5 tests
- One point per take, order preserved
- CQI rounded to one decimal
- Null CQI renders as null (chart connects across)
- Hesitation duration summed per take, ignoring non-hesitation signals
- Hesitation rounded to one decimal

These are pinned. If you refactor and one of these starts failing, you've broken behavior the coach relies on.

## Task 4 findings (async / state self-review)

I went through the three flagged areas. No state-machine bugs. One real demo-blocking risk found and fixed:

| Area | Finding | Action |
|---|---|---|
| Onboarding `imagePromiseRef` | Set synchronously before `setStep("description")`, no race. | None. |
| Onboarding image promise rejection | `.catch(() => null)` ensures `Promise.all` never throws. | None. |
| Onboarding "stub description" passed to Q1 image gen | Intentional per the build plan. | None. |
| **Onboarding image-gen wait** | **No timeout — if Gemini hangs, user is stuck on "Composing the scene." forever. Demo-breaking.** | **Fixed: 30 s race in [components/Onboarding.tsx:42-47](components/Onboarding.tsx#L42).** |
| **Onboarding scenario fetch** | **Same risk — Anthropic could hang.** | **Fixed: 30 s race in [components/Onboarding.tsx:91-95](components/Onboarding.tsx#L91).** |
| Recorder state machine | Button rendering gates status transitions correctly — no way to fire Begin during analyze, no way to fire End before recording. | None. |
| Recorder analyze closure | Was the original stale-closure bug. Fixed via `analyzeRef` in the overnight commit. Pinned by [tests/coach-prompt.test.ts](tests/coach-prompt.test.ts). | None. |
| Recorder retry after failure | Take number stays the same because `takes.length` only changes after a successful `onTakeComplete`. | None. |
| localStorage races | Synchronous, single-tab. Multi-tab clobbering is out of scope for the demo. | None. |
| MediaRecorder mid-record unmount | Tracks stop on unmount; the MediaRecorder itself isn't explicitly stopped. Edge case (would require navigating away mid-record). | None. |

The two timeouts are the only behavior change in this section. Without them, a slow upstream would silently hang the demo.

## Assumptions

1. **MOCK_MODE flag value**: any of `true` or `on` enables it; everything else (including unset) is off. The flag is read at request time on the server and at render time on the client, so changing `.env.local` requires a `npm run dev` restart.
2. **Procedural backdrop appearance**: index-cards-on-corkboard with connecting string. I chose this over the "clinical empty room" because it reads as more intentional in mono and gives the eye more to look at during the demo. If you'd rather see the empty room, let me know.
3. **Coach mock lines** are deterministic but NOT identical for the same take number — they branch on signal mix and history presence. The set is small (~5 templates) which is appropriate for a toy.
4. **Preset scenarios:** I picked the three from the build plan's seed list (raise, cold coffee, roommate dishes). Free-text path is preserved alongside, and the chat input still appears below the preset buttons on the first screen.
5. **The `_forceFail` field in `/api/coach`** is a test-only request override for simulating coach failures from curl. It is not exposed in the client and not documented in any user-facing surface; it lets the demo team verify the fallback path before the founders walk in. Remove it (and the corresponding test fixture) if you'd rather not have it in the route handler at all.
6. **Image route timeout** is on the *client* in Onboarding, not the server. The server route still waits for Gemini to respond (could be 60 s+ on a cold start). The client race lets the user proceed without it after 30 s, but the server request continues in the background and is discarded by GC. Acceptable for the demo.
7. **TTS in MOCK_MODE returns 503** — the client gracefully shows the report without audio. If you want canned audio in mock mode too (e.g. a silent placeholder mp3), say so and I'll add one.

## Open / left for later

- **Streaming ticker** — still scaffolded, still flag-off, still not imported anywhere. No change tonight.
- **Multi-tab / multi-device session sync** — out of scope. Single tab.
- **Actual visual snapshot tests for the curve** — no snapshot tests added; the data transform is tested but the rendered Recharts SVG isn't. Unlikely to regress visually.
- **No git push / no PR.** Repo is local-only. Six commits since last session, history is clean.

## If something goes wrong tomorrow

The likeliest in-front-of-founders failures and the recovery:

1. **Image route 5xx or slow.** Onboarding waits 30 s max, then proceeds with the fail-soft "set could not be constructed" backdrop. Demo continues.
2. **Coach LLM 5xx or rate-limit.** Route returns 200 with a fallback line ("The behavioural model returned, but the assessment did not. I have noted the time and the take number. We will do one more.") Demo continues.
3. **TTS rate-limit.** Audio is skipped, report text still appears with typing animation. Demo continues.
4. **Inter-1 5xx.** Recorder catches the analyze failure → "The assessment could not be completed. The rehearsal will pause." → Try again button. The take is not committed, so the curve doesn't advance. **If this happens repeatedly during demo, switch to MOCK_MODE between takes.**
5. **Camera permission denied.** Calm "Camera or microphone access was denied. The rehearsal cannot begin." + Try again button.

Worst-case: kill the dev server, set `NEXT_PUBLIC_MOCK_MODE=true` in `.env.local`, restart, run the preset path. The entire flow works fully offline.
