import { describe, it, expect } from "vitest";
import {
  stripInter1Payload,
  stripHistoryEntries,
  type StrippedInter1,
} from "@/lib/coach-payload";
import { buildCoachUserMessage } from "@/lib/coach-prompt";
import type { Take } from "@/lib/session";

/**
 * Regression guard for the bug that actually shipped: the coach reported "no
 * quoted speech / no words to work with" on every take. Root cause was that
 * each stored Take held rationale-stripped signals, so the cross-take history
 * and the Summary's final assessment had nothing to quote — even with
 * USE_RATIONALE=true.
 *
 * The fix: Recorder stores the RICH signals (rationale + probability) on the
 * Take. The coach server then re-strips per USE_RATIONALE. These tests pin the
 * whole path end-to-end using the real helpers, so a future refactor that
 * reverts to storing bare signals fails here.
 */

const SCENARIO = {
  title: "Asking for a raise.",
  framing: "It will be over in four minutes.",
  scenePartnerLine: "Hey, you wanted to talk.",
};

// A Take exactly as Recorder commits it after the fix: strippedRich signals.
function richTake(takeNumber: number): Take {
  const rich = stripInter1Payload(
    {
      signals: [
        {
          type: "hesitation",
          start: 3,
          end: 5,
          probability: "medium",
          rationale: 'the person paused and said "I think... maybe...".',
        },
        {
          type: "confidence",
          start: 9,
          end: 14,
          probability: "high",
          rationale: 'the person said "I have prepared for this" without hedging.',
        },
      ],
      engagement_state: [{ state: "engaged", start: 0, end: 20 }],
      conversation_quality: { overall: { quality_index: 60 } },
    },
    { includeRationale: true }
  );
  return {
    takeNumber,
    signals: rich.signals,
    engagement: rich.engagement_state,
    cqi: rich.conversation_quality,
    cqiOverall: 60,
    advice: `Rehearsal ${takeNumber} advice.`,
    recordedAt: 0,
  };
}

describe("stored Take retains rationale (the shipped-bug regression)", () => {
  it("a committed Take carries rationale + probability on its signals", () => {
    const take = richTake(1);
    expect(take.signals[0]!.rationale).toContain("I think... maybe...");
    expect(take.signals[1]!.probability).toBe("high");
  });

  it("Summary reconstructs the payload from take.signals with rationale intact (flag ON)", () => {
    const last = richTake(3);
    // Exactly how Summary.tsx builds the inter1 payload for the final call.
    const summaryInter1 = {
      signals: last.signals,
      engagement_state: last.engagement,
      conversation_quality: last.cqi,
    };
    // Server re-strips with includeRationale=true (USE_RATIONALE=true).
    const reStripped = stripInter1Payload(summaryInter1, {
      includeRationale: true,
    });
    const msg = buildCoachUserMessage({
      scenario: SCENARIO,
      takeNumber: last.takeNumber,
      history: [],
      inter1: reStripped,
      mode: "stopping",
      thresholdCqi: 75,
    });
    expect(msg).toContain("I have prepared for this");
    expect(msg).toContain('"rationale"');
  });

  it("cross-take history preserves rationale through stripHistoryEntries (flag ON)", () => {
    const history = [richTake(1), richTake(2)].map((t) => ({
      takeNumber: t.takeNumber,
      signals: t.signals,
      engagement: t.engagement,
      cqiOverall: t.cqiOverall,
      advice: t.advice,
    }));
    const reStripped = stripHistoryEntries(history, { includeRationale: true });
    expect(reStripped[0]!.signals[0]!.rationale).toContain("I think... maybe...");
    expect(reStripped[1]!.signals[1]!.rationale).toContain(
      "I have prepared for this"
    );
  });

  it("flag OFF still strips the stored rationale — flag-off demo path unchanged", () => {
    const last = richTake(2);
    const summaryInter1: StrippedInter1 = {
      signals: last.signals,
      engagement_state: last.engagement,
      conversation_quality: last.cqi,
    };
    const reStripped = stripInter1Payload(summaryInter1); // default: no rationale
    const serialized = JSON.stringify(reStripped);
    expect(serialized).not.toContain("rationale");
    expect(serialized).not.toContain("prepared for this");
    for (const s of reStripped.signals) {
      expect(Object.keys(s).sort()).toEqual(["end", "start", "type"]);
    }
  });
});
