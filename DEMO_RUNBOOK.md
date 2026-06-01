# DEMO_RUNBOOK — The Rehearsal

One screen. Follow top to bottom. Don't skip.

## Before the founders walk in

1. **Open the project, set env, start dev server.**
   ```
   cd "/Users/patrizio/Desktop/internal challenge"
   # In .env.local, confirm:
   #   NEXT_PUBLIC_MOCK_MODE=false
   #   NEXT_PUBLIC_ENABLE_STREAM=false
   # All five keys present: INTERHUMAN_API_KEY, ELEVENLABS_API_KEY,
   # ELEVENLABS_VOICE_ID, GEMINI_API_KEY, ANTHROPIC_API_KEY.
   npm run dev
   ```
2. **Open `http://localhost:3000` in Chrome** (not Safari — MediaRecorder webm support is best in Chrome).
3. **Grant camera + microphone permission** when prompted.
4. **Clear any stale localStorage session:** open DevTools → Application → Local Storage → delete `the-rehearsal:session:v1`. (Or just click "Begin a new scenario" from any summary screen you might be on.)
5. **Verify the dev server log is clean** — no upstream 5xx in the last few lines.

## The live demo path (≤ 4 minutes)

Use a **preset**. Not the free-text path. Presets are reproducible and don't depend on the LLM composing a scenario.

1. Click **"Asking your manager for a raise."** (or whichever preset reads best in the room — pub one is "Returning a cold coffee.")
2. The beats cycle: *Composing the scene. → Constructing the set. → Reviewing the materials.* Gemini generates the set image in the background. This takes 8–25 s; the beats mask it.
3. Recorder screen lands. You should see:
   - Left: a generated photo of you in the appropriate location, laptop slung on a courier strap, flowchart taped behind you.
   - Right: live webcam preview.
   - Header: scenario title + framing.
   - Bottom: scene-partner's opening line in a card.
4. **Click "Begin take 1."** Talk for 10–20 seconds — give your raise pitch. Click **"End take."**
5. Beats run: *Analyzing the take. → Composing the assessment. → Voicing the assessment.*
6. Playback: video plays muted, the deadpan voice speaks the report over it, the report text types out below.
7. **Click "Rehearse again."** Counter advances to #2. Do another take.
8. After take 2, the **improvement curve** appears at the bottom. CQI and hesitation are plotted.
9. Repeat once more if the room is engaged. When you cross CQI ≥ 75, the "Stop here" button label changes to **"Stop here. You may."** That's the threshold beat.
10. **Click "Stop here. You may."** → Summary screen.
11. Summary shows take count, the curve, and a final deadpan coach line that *does not propose another rehearsal* and acknowledges you could have continued.
12. End.

**Best preset to demo: "Asking your manager for a raise."** It's universal, the founders all relate to it, and the generated office set tends to come out cleanest.

## If something wobbles live — single fallback move

**Flip to mock mode and restart.** The entire flow works fully offline with canned data; the only differences are the procedural SVG backdrop and no audio.

```
# Edit .env.local:
#   NEXT_PUBLIC_MOCK_MODE=true
# Then:
# Ctrl-C the dev server, then:
npm run dev
# Refresh the page.
```

The takes will follow a canned arc: **take 1 → CQI 38, take 2 → 52, take 3 → 64, take 4 → 78 (threshold), take 5+ → ~85.** The coach narrates from those numbers and the cross-take history. Curve still builds. Threshold still flips the button. Summary still composes the closing line. Demo is intact, just without audio and with a different-looking set.

## If X breaks, do Y

| Symptom | What it is | What you do |
|---|---|---|
| Set image card shows "The set could not be constructed." | Gemini either timed out (>30 s) or returned an error. Onboarding proceeded without the image rather than hang. | Continue. The line reads as in-register. The rehearsal works without the image. |
| Report appears but no voice plays | ElevenLabs failed OR Chrome blocked autoplay. The text + replay video are still there. | Click **"Replay."** It's a user gesture so audio will play this time. |
| "The assessment could not be completed. The rehearsal will pause." | Inter-1 or coach hit a network drop or a real 5xx. Take did not commit. | Click **"Try again,"** then **"Begin take N"** (same take number — failure didn't advance the counter). |
| "Camera or microphone access was denied." | Permission denied or no device. | Grant permission in the browser address-bar icon → reload. |
| Spinner / "Analyzing the take." stuck for >60 s | Shouldn't happen — all fetches now have timeouts — but if it does: | Reload the tab. State persists in localStorage, you'll resume mid-session. |
| Anything else cursed | The whole stack hung or you're getting weird errors. | Mock-mode fallback above. Costs 30 seconds. |

## What NOT to touch during the demo

- Don't refresh mid-take. (Mid-session is fine; mid-take loses the recording.)
- Don't open DevTools and start poking — the demo is a fragile sequence of state changes, not a debug session.
- Don't try the free-text onboarding live. Use the preset. Free-text adds an extra LLM hop that can be slow or weird.
- Don't enable `NEXT_PUBLIC_ENABLE_STREAM` — the WebSocket ticker is scaffolded but untested in browser; it's not wired into the Recorder anyway, so toggling it does nothing visible, but don't waste time.

## What's good to know but you won't say

- Behind it: Inter-1 → Anthropic Claude Sonnet 4.6 → ElevenLabs → Gemini Nano Banana Pro. Four providers, all on the demo path. Any one going down → fail-soft → demo continues.
- The coach prompt is locked: 21 Vitest tests pin the strip, the history pass-through, the threshold note, the scenario parser, and the curve transform. If you accidentally regress one of those, `npm test` will catch it before the demo.
- The "MOCK SET" caption on the procedural backdrop is the giveaway that you're in mock mode. If you see that during a live demo, you forgot to flip the flag back.

## After

- The session persists in localStorage. "Begin a new scenario" from the summary clears it. Or you can clear it manually in DevTools.
- The two generated images from earlier ([scripts/out/v2-park.png](scripts/out/v2-park.png) etc.) are saved as samples but are not used by the running app. The app generates fresh ones per session.
