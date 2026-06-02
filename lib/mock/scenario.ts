import type { Scenario } from "@/lib/scenario";

/**
 * Canned scenario for MOCK_MODE. We use the user-supplied scene/description
 * to keep the title personalised, but the framing and partner line are
 * deterministic so the offline run is reproducible.
 */
export function mockScenario(args: {
  scene: string;
  description?: string;
}): Scenario {
  const scene = args.scene.trim() || "an unspecified location";
  const description = args.description?.trim();
  return {
    title: "A rehearsal of the upcoming interaction.",
    scenePartnerLine: "Hey. You wanted to speak with me about something.",
    framing: `The interaction will take place in ${scene}. The rehearsal will proceed in private until adequacy is reached.`,
    ...(description
      ? { background: `The person states the following about this interaction: ${description}` }
      : {}),
  };
}
