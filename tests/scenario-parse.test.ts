import { describe, it, expect } from "vitest";
import {
  tryParseScenario,
  FALLBACK_SCENARIO_API,
} from "@/lib/scenario-parse";

describe("tryParseScenario", () => {
  it("parses a plain JSON object into a Scenario", () => {
    const json = JSON.stringify({
      title: "Asking your roommate to do the dishes.",
      scenePartnerLine: "Hey, you needed something.",
      framing: "The kitchen has been in this state for nine days.",
    });
    const out = tryParseScenario(json);
    expect(out).toEqual({
      title: "Asking your roommate to do the dishes.",
      scenePartnerLine: "Hey, you needed something.",
      framing: "The kitchen has been in this state for nine days.",
    });
  });

  it("strips ```json ... ``` code fences before parsing", () => {
    const fenced = '```json\n{"title":"A","scenePartnerLine":"B","framing":"C"}\n```';
    const out = tryParseScenario(fenced);
    expect(out).toEqual({ title: "A", scenePartnerLine: "B", framing: "C" });
  });

  it("returns null on malformed JSON", () => {
    expect(tryParseScenario("not json at all")).toBeNull();
    expect(tryParseScenario("{title:'broken'}")).toBeNull();
    expect(tryParseScenario("")).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    expect(tryParseScenario(JSON.stringify({ title: "only this" }))).toBeNull();
    expect(
      tryParseScenario(
        JSON.stringify({ title: "x", scenePartnerLine: "y" }) // missing framing
      )
    ).toBeNull();
  });

  it("FALLBACK_SCENARIO_API is in register (deadpan, no exclamation, no emoji)", () => {
    const merged =
      FALLBACK_SCENARIO_API.title +
      FALLBACK_SCENARIO_API.scenePartnerLine +
      FALLBACK_SCENARIO_API.framing;
    expect(merged).not.toMatch(/!/);
    // no emoji surrogate pairs
    expect(merged).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});
