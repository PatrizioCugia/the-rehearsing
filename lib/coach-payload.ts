/**
 * Shape the coach ever sees. Anything outside this is stripped on the client
 * before persisting to history AND on the server before being sent to Claude.
 * Belt-and-suspenders: if the API ever returns rationale, probability, or
 * transcript fields, they get filtered both places.
 */

export type Inter1Signal = { type: string; start: number; end: number };
export type Inter1Engagement = { state: string; start: number; end: number };
export type Inter1CQI = {
  overall?: Record<string, number>;
  timeline?: Array<{
    start: number;
    end: number;
    values: Record<string, number>;
  }>;
};

export type StrippedInter1 = {
  signals: Inter1Signal[];
  engagement_state?: Inter1Engagement[];
  conversation_quality?: Inter1CQI;
};

export type HistoryEntryForCoach = {
  takeNumber: number;
  signals: Inter1Signal[];
  engagement?: Inter1Engagement[];
  cqiOverall?: number;
  advice: string;
};

export function stripInter1Payload(raw: unknown): StrippedInter1 {
  const src = (raw ?? {}) as Record<string, unknown>;
  const signals = Array.isArray(src.signals)
    ? (src.signals as Array<Record<string, unknown>>).map((s) => ({
        type: String(s.type ?? ""),
        start: Number(s.start ?? 0),
        end: Number(s.end ?? 0),
      }))
    : [];
  const out: StrippedInter1 = { signals };
  if (Array.isArray(src.engagement_state)) {
    out.engagement_state = (src.engagement_state as Array<Record<string, unknown>>).map(
      (e) => ({
        state: String(e.state ?? ""),
        start: Number(e.start ?? 0),
        end: Number(e.end ?? 0),
      })
    );
  }
  if (src.conversation_quality && typeof src.conversation_quality === "object") {
    out.conversation_quality = src.conversation_quality as Inter1CQI;
  }
  return out;
}

export function stripHistoryEntries(raw: unknown): HistoryEntryForCoach[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>).map((h) => {
    const signals = Array.isArray(h.signals)
      ? (h.signals as Array<Record<string, unknown>>).map((s) => ({
          type: String(s.type ?? ""),
          start: Number(s.start ?? 0),
          end: Number(s.end ?? 0),
        }))
      : [];
    const engagement = Array.isArray(h.engagement)
      ? (h.engagement as Array<Record<string, unknown>>).map((e) => ({
          state: String(e.state ?? ""),
          start: Number(e.start ?? 0),
          end: Number(e.end ?? 0),
        }))
      : undefined;
    return {
      takeNumber: Number(h.takeNumber ?? 0),
      signals,
      engagement,
      cqiOverall: typeof h.cqiOverall === "number" ? h.cqiOverall : undefined,
      advice: String(h.advice ?? ""),
    };
  });
}
