import { describe, it, expect } from "vitest";
import { buildCoachUserMessage } from "@/lib/coach-prompt";
import type { HistoryEntryForCoach, StrippedInter1 } from "@/lib/coach-payload";

const SCENARIO = {
  title: "Asking for a raise.",
  framing: "It will be over in four minutes.",
  scenePartnerLine: "Hey, you wanted to talk.",
};

function fakeHistory(n: number): HistoryEntryForCoach[] {
  return Array.from({ length: n }, (_, i) => ({
    takeNumber: i + 1,
    signals: [{ type: "hesitation", start: 2, end: 5 + i }],
    cqiOverall: 40 + i * 5,
    advice: `Rehearsal ${i + 1} advice text.`,
  }));
}

const baseInter1: StrippedInter1 = {
  signals: [{ type: "confidence", start: 1, end: 3 }],
  conversation_quality: { overall: { quality_index: 62 } },
};

describe("buildCoachUserMessage — history pass-through (stale-closure regression)", () => {
  it("on take N includes exactly N-1 prior takes in the prompt", () => {
    for (const N of [1, 2, 5, 8]) {
      const msg = buildCoachUserMessage({
        scenario: SCENARIO,
        takeNumber: N,
        history: fakeHistory(N - 1),
        inter1: baseInter1,
        mode: "continuing",
        thresholdCqi: 75,
      });
      if (N === 1) {
        expect(msg).toContain("There are no prior takes.");
      } else {
        expect(msg).toContain("Prior takes (oldest first):");
        for (let i = 1; i <= N - 1; i++) {
          expect(msg).toContain(`Take ${i}:`);
          expect(msg).toContain(`Rehearsal ${i} advice text.`);
        }
        // No phantom future takes.
        expect(msg).not.toContain(`Take ${N}: CQI overall`);
      }
      expect(msg).toContain(`This is take number ${N}.`);
    }
  });

  it("escapes nothing weird and includes the current inter1 payload as JSON", () => {
    const msg = buildCoachUserMessage({
      scenario: SCENARIO,
      takeNumber: 2,
      history: fakeHistory(1),
      inter1: baseInter1,
      mode: "continuing",
      thresholdCqi: 75,
    });
    expect(msg).toMatch(/```json[\s\S]*"signals"[\s\S]*```/);
  });
});

describe("buildCoachUserMessage — case background", () => {
  it("includes the intake background as case context when present", () => {
    const msg = buildCoachUserMessage({
      scenario: {
        ...SCENARIO,
        background:
          "The person is asking their manager Ivan for a raise. They report being shy.",
      },
      takeNumber: 1,
      history: [],
      inter1: baseInter1,
      mode: "continuing",
      thresholdCqi: 75,
    });
    expect(msg).toContain("Case background");
    expect(msg).toContain("Ivan");
    expect(msg).toContain("shy");
  });

  it("omits the background line entirely when not provided", () => {
    const msg = buildCoachUserMessage({
      scenario: SCENARIO,
      takeNumber: 1,
      history: [],
      inter1: baseInter1,
      mode: "continuing",
      thresholdCqi: 75,
    });
    expect(msg).not.toContain("Case background");
  });
});

describe("buildCoachUserMessage — threshold logic", () => {
  it("adds the stop-context note when CQI >= 75 and mode is continuing", () => {
    const inter1 = {
      ...baseInter1,
      conversation_quality: { overall: { quality_index: 78 } },
    };
    const msg = buildCoachUserMessage({
      scenario: SCENARIO,
      takeNumber: 3,
      history: fakeHistory(2),
      inter1,
      mode: "continuing",
      thresholdCqi: 75,
    });
    expect(msg).toContain("personal threshold of 75");
    expect(msg).toContain("could stop here");
    expect(msg).toContain("still proposing the next rehearsal");
  });

  it("does NOT add the threshold note when CQI < threshold", () => {
    const msg = buildCoachUserMessage({
      scenario: SCENARIO,
      takeNumber: 3,
      history: fakeHistory(2),
      inter1: baseInter1, // CQI 62
      mode: "continuing",
      thresholdCqi: 75,
    });
    expect(msg).not.toContain("personal threshold");
  });

  it("uses the stopping branch when mode is stopping (regardless of CQI)", () => {
    const msg = buildCoachUserMessage({
      scenario: SCENARIO,
      takeNumber: 5,
      history: fakeHistory(4),
      inter1: baseInter1,
      mode: "stopping",
      thresholdCqi: 75,
    });
    expect(msg).toContain("The person has chosen to stop");
    expect(msg).toContain("Do not propose another rehearsal");
    // The threshold note should not also appear in stopping mode.
    expect(msg).not.toContain("personal threshold");
  });
});

describe("buildCoachUserMessage — rationale-on payload makes it into the prompt", () => {
  it("includes the rationale text verbatim in the JSON block so the coach can cite it", () => {
    const richInter1: StrippedInter1 = {
      signals: [
        {
          type: "agreement",
          start: 0,
          end: 5,
          probability: "high",
          rationale:
            "the person nodded warmly and said \"Andando, perfetto\".",
        },
      ],
      conversation_quality: { overall: { quality_index: 56 } },
    };
    const msg = buildCoachUserMessage({
      scenario: SCENARIO,
      takeNumber: 1,
      history: [],
      inter1: richInter1,
      mode: "continuing",
      thresholdCqi: 75,
    });
    expect(msg).toContain("\"probability\": \"high\"");
    expect(msg).toContain("Andando, perfetto");
    expect(msg).toContain("\"rationale\"");
  });
});
