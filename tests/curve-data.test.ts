import { describe, it, expect } from "vitest";
import { buildTakeTimelines, cqiFace } from "@/lib/curve-data";
import type { Take } from "@/lib/session";

function take(args: Partial<Take> & { takeNumber: number }): Take {
  return {
    takeNumber: args.takeNumber,
    signals: args.signals ?? [],
    engagement: args.engagement,
    cqi: args.cqi,
    cqiOverall: args.cqiOverall,
    advice: args.advice ?? "",
    recordedAt: args.recordedAt ?? 0,
  };
}

describe("buildTakeTimelines", () => {
  it("emits one timeline per take, preserving order", () => {
    const out = buildTakeTimelines([
      take({ takeNumber: 1, cqiOverall: 38 }),
      take({ takeNumber: 2, cqiOverall: 62 }),
    ]);
    expect(out.map((t) => t.takeNumber)).toEqual([1, 2]);
    expect(out.map((t) => t.cqi)).toEqual([38, 62]);
  });

  it("rounds CQI to one decimal and nulls missing CQI", () => {
    const out = buildTakeTimelines([
      take({ takeNumber: 1, cqiOverall: 63.7777 }),
      take({ takeNumber: 2 }),
    ]);
    expect(out[0]!.cqi).toBe(63.8);
    expect(out[1]!.cqi).toBeNull();
  });

  it("derives duration from the latest signal or engagement end (min 1)", () => {
    const out = buildTakeTimelines([
      take({
        takeNumber: 1,
        signals: [{ type: "stress", start: 0, end: 12 }],
        engagement: [{ state: "engaged", start: 0, end: 20 }],
      }),
    ]);
    expect(out[0]!.duration).toBe(20);
  });

  it("defaults duration to 1 when a take has no signals or engagement", () => {
    const out = buildTakeTimelines([take({ takeNumber: 1 })]);
    expect(out[0]!.duration).toBe(1);
    expect(out[0]!.signals).toEqual([]);
  });

  it("sorts signals by start and packs overlaps into separate lanes", () => {
    const out = buildTakeTimelines([
      take({
        takeNumber: 1,
        signals: [
          { type: "interest", start: 2, end: 8 }, // overlaps stress
          { type: "stress", start: 0, end: 5 },
          { type: "confidence", start: 9, end: 12 }, // after both → lane 0 reused
        ],
      }),
    ]);
    const s = out[0]!.signals;
    // Sorted by start.
    expect(s.map((x) => x.type)).toEqual(["stress", "interest", "confidence"]);
    // stress lane 0, interest overlaps → lane 1, confidence reuses lane 0.
    expect(s[0]!.lane).toBe(0);
    expect(s[1]!.lane).toBe(1);
    expect(s[2]!.lane).toBe(0);
  });

  it("carries probability and rationale through onto the timeline signal", () => {
    const out = buildTakeTimelines([
      take({
        takeNumber: 1,
        signals: [
          {
            type: "hesitation",
            start: 1,
            end: 3,
            probability: "high",
            rationale: 'the person said "um".',
          },
        ],
      }),
    ]);
    expect(out[0]!.signals[0]!.probability).toBe("high");
    expect(out[0]!.signals[0]!.rationale).toContain("um");
  });
});

describe("cqiFace", () => {
  it("maps score bands to deadpan text faces", () => {
    expect(cqiFace(80)).toBe(":)");
    expect(cqiFace(75)).toBe(":)");
    expect(cqiFace(60)).toBe(":/");
    expect(cqiFace(50)).toBe(":/");
    expect(cqiFace(38)).toBe(":(");
    expect(cqiFace(null)).toBe("··");
  });
});
