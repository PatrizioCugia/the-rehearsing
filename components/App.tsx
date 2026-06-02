"use client";

import { useCallback, useEffect, useState } from "react";
import Onboarding from "./Onboarding";
import Recorder from "./Recorder";
import Summary from "./Summary";
import type { Scenario } from "@/lib/scenario";
import {
  loadSession,
  saveSession,
  clearSession,
  type Session,
  type Take,
} from "@/lib/session";

type Phase = "onboarding" | "recording" | "summary";

export default function App() {
  const [phase, setPhase] = useState<Phase>("onboarding");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [setImageUrl, setSetImageUrl] = useState<string | null>(null);
  const [takes, setTakes] = useState<Take[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Restore prior in-progress session on mount, if any.
  useEffect(() => {
    const s = loadSession();
    if (s) {
      setScenario(s.scenario);
      setSetImageUrl(s.setImageUrl);
      setTakes(s.takes);
      setPhase("recording");
    }
    setHydrated(true);
  }, []);

  // Persist session whenever state changes (after hydration).
  useEffect(() => {
    if (!hydrated) return;
    if (!scenario || phase === "onboarding") return;
    const session: Session = {
      version: 1,
      scenario,
      setImageUrl,
      takes,
      startedAt: Date.now(),
    };
    saveSession(session);
  }, [hydrated, scenario, setImageUrl, takes, phase]);

  const handleOnboardingDone = useCallback(
    (result: { scenario: Scenario; imageUrl: string | null }) => {
      clearSession();
      setScenario(result.scenario);
      setSetImageUrl(result.imageUrl);
      setTakes([]);
      setPhase("recording");
    },
    []
  );

  const handleTakeComplete = useCallback((take: Take) => {
    setTakes((prev) => [...prev, take]);
  }, []);

  const handleQuit = useCallback(() => {
    setPhase("summary");
  }, []);

  const handleNewSession = useCallback(() => {
    clearSession();
    setScenario(null);
    setSetImageUrl(null);
    setTakes([]);
    setPhase("onboarding");
  }, []);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-600 text-xs uppercase tracking-widest">
          Initialising.
        </p>
      </div>
    );
  }

  if (phase === "onboarding" || !scenario) {
    return <Onboarding onDone={handleOnboardingDone} />;
  }

  if (phase === "summary") {
    return (
      <Summary
        scenario={scenario}
        takes={takes}
        setImageUrl={setImageUrl}
        onNewSession={handleNewSession}
      />
    );
  }

  return (
    <Recorder
      scenario={scenario}
      setImageUrl={setImageUrl}
      takes={takes}
      onTakeComplete={handleTakeComplete}
      onQuit={handleQuit}
      onRestart={handleNewSession}
    />
  );
}
