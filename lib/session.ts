import type { Scenario } from "@/lib/scenario";
import type {
  Inter1Engagement,
  Inter1Signal,
  Inter1CQI,
} from "@/lib/coach-payload";

export type Take = {
  takeNumber: number;
  signals: Inter1Signal[];
  engagement?: Inter1Engagement[];
  cqi?: Inter1CQI;
  cqiOverall?: number;
  advice: string;
  recordedAt: number;
};

export type Session = {
  version: 1;
  scenario: Scenario;
  setImageUrl: string | null;
  takes: Take[];
  startedAt: number;
};

const STORAGE_KEY = "the-rehearsal:session:v1";

export const THRESHOLD_CQI = 75;

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (parsed?.version !== 1 || !parsed.scenario) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore quota errors; the demo doesn't depend on persistence.
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
