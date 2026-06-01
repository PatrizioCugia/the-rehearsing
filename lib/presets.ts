import type { Scenario } from "@/lib/scenario";

/**
 * Pre-written deadpan scenarios. Three, mundane, personal, a little sad.
 * Used as the safe happy-path for the live demo. Selecting one skips the
 * two-message chat and goes straight into the rehearsal.
 *
 * Each preset includes:
 *  - id (stable for selection)
 *  - label (short, button text)
 *  - location and description (the same inputs the chat would have produced;
 *    fed to /api/image so the set image is still personalised to the preset)
 *  - scenario (fixed; not re-composed by the LLM, so the demo is reproducible)
 */

export type Preset = {
  id: string;
  label: string;
  location: string;
  description: string;
  scenario: Scenario;
};

export const PRESETS: Preset[] = [
  {
    id: "raise",
    label: "Asking your manager for a raise.",
    location:
      "a small empty conference room inside an open-plan tech office, glass walls, late afternoon",
    description:
      "rehearsing how to ask my manager for a raise tomorrow morning",
    scenario: {
      title: "Asking your manager for a raise. Tomorrow morning.",
      scenePartnerLine: "Hey. You wanted to talk about something.",
      framing:
        "You have rehearsed this in your head four times. None of those counted. The next conversation counts.",
    },
  },
  {
    id: "coffee",
    label: "Returning a cold coffee.",
    location:
      "the back corner of a quiet coffee shop, mid-morning, two other customers visible",
    description:
      "returning a coffee that is colder than I expected to the same barista who gave it to me",
    scenario: {
      title: "Returning a cold coffee to the same barista who made it.",
      scenePartnerLine: "Hi again. Did you need something else.",
      framing:
        "The coffee has been cold for nine minutes. You have been holding it for nine minutes. The barista has been watching.",
    },
  },
  {
    id: "roommate",
    label: "Telling your roommate to do the dishes.",
    location:
      "the kitchen of a small two-bedroom apartment, late evening, the sink visible behind",
    description:
      "telling my roommate that the dishes have been there for five days and I would like them to be washed",
    scenario: {
      title: "Telling your roommate the dishes have been there for five days.",
      scenePartnerLine: "Oh hey, what's up.",
      framing:
        "Your roommate is friendly. You have rehearsed this conversation eleven times. The dishes are still there.",
    },
  },
];
