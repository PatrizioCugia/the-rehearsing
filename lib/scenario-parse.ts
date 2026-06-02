import type { Scenario } from "@/lib/scenario";

export const FALLBACK_SCENARIO_API: Scenario = {
  title: "An interaction the person has decided to prepare for.",
  scenePartnerLine: "Have a seat.",
  framing:
    "The details have been omitted. The rehearsal will proceed without them.",
};

/**
 * Parse the scenario JSON the LLM returns. Strips code fences if any, returns
 * null on malformed input. Pure — no side effects, safe to unit-test.
 */
export function tryParseScenario(text: string): Scenario | null {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }
  try {
    const obj = JSON.parse(t) as Partial<Scenario>;
    if (
      obj &&
      typeof obj.title === "string" &&
      typeof obj.scenePartnerLine === "string" &&
      typeof obj.framing === "string"
    ) {
      return {
        title: obj.title,
        scenePartnerLine: obj.scenePartnerLine,
        framing: obj.framing,
        ...(typeof obj.background === "string" && obj.background.trim()
          ? { background: obj.background.trim() }
          : {}),
      };
    }
  } catch {
    /* fall through */
  }
  return null;
}
