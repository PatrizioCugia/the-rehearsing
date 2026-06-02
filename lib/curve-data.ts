import type { Take } from "@/lib/session";
import type { Inter1Signal } from "@/lib/coach-payload";

export type TimelineSignal = Inter1Signal & { lane: number };

export type TakeTimeline = {
  takeNumber: number;
  cqi: number | null;
  /** Seconds the timeline spans — the latest signal/engagement end, min 1. */
  duration: number;
  signals: TimelineSignal[];
};

/**
 * Pure transform: history → one timeline per take. Each signal keeps its
 * in-take start/end (plus probability/rationale when present) and gets a lane
 * index so overlapping signals stack instead of colliding. Extracted from the
 * component for testability.
 */
export function buildTakeTimelines(takes: Take[]): TakeTimeline[] {
  return takes.map((t) => {
    const ends: number[] = [];
    for (const s of t.signals) ends.push(s.end);
    for (const e of t.engagement ?? []) ends.push(e.end);
    const duration = ends.length ? Math.max(1, ...ends) : 1;
    const signals = packLanes(
      [...t.signals].sort((a, b) => a.start - b.start)
    );
    return {
      takeNumber: t.takeNumber,
      cqi:
        typeof t.cqiOverall === "number"
          ? Math.round(t.cqiOverall * 10) / 10
          : null,
      duration,
      signals,
    };
  });
}

/**
 * Greedy interval-packing: assign each signal to the first lane whose previous
 * signal has already ended. Signals must be pre-sorted by start time.
 */
function packLanes(sorted: Inter1Signal[]): TimelineSignal[] {
  const laneEnds: number[] = [];
  return sorted.map((s) => {
    let lane = laneEnds.findIndex((end) => end <= s.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(s.end);
    } else {
      laneEnds[lane] = s.end;
    }
    return { ...s, lane };
  });
}

/** Deadpan text face for a CQI score. Three coarse bands. */
export function cqiFace(cqi: number | null): string {
  if (cqi == null) return "··";
  if (cqi >= 75) return ":)";
  if (cqi >= 50) return ":/";
  return ":(";
}
