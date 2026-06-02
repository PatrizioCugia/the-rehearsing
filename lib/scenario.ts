export type Scenario = {
  title: string;
  scenePartnerLine: string;
  framing: string;
  /**
   * A short flat factual note distilled from what the person told us at intake
   * (who the partner is, why this matters, the stakes they named). The coach
   * receives this as established case context — not as something observed on
   * camera — so the substance the person typed actually informs the report.
   */
  background?: string;
};

export const FALLBACK_SCENARIO: Scenario = {
  title: "An interaction the person has decided to prepare for.",
  scenePartnerLine: "Have a seat.",
  framing: "The details have been omitted. The rehearsal will proceed without them.",
};
