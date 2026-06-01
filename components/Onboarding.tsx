"use client";

import { useCallback, useRef, useState } from "react";
import type { Scenario } from "@/lib/scenario";

type Step = "location" | "description" | "composing";

type Msg = { from: "coach" | "user"; text: string };

const Q1 = "Where does this rehearsal take place.";
const Q2 = "Now describe yourself and what you are rehearsing. Be specific.";

export default function Onboarding(props: {
  onDone: (result: { scenario: Scenario; imageUrl: string | null }) => void;
}) {
  const [step, setStep] = useState<Step>("location");
  const [messages, setMessages] = useState<Msg[]>([{ from: "coach", text: Q1 }]);
  const [draft, setDraft] = useState("");
  const [composingBeat, setComposingBeat] = useState<string>("Composing the scene.");
  const imagePromiseRef = useRef<Promise<string | null> | null>(null);
  const locationRef = useRef<string>("");

  const startImageGen = useCallback((location: string, description: string) => {
    const imageFetch = fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location, description }),
    })
      .then(async (r) => {
        if (!r.ok) return null;
        const j = (await r.json()) as { image?: string };
        return j.image ?? null;
      })
      .catch(() => null);
    // Demo safety: bound the image wait. If Gemini hangs, we proceed without it.
    const timeout = new Promise<string | null>((resolve) =>
      setTimeout(() => resolve(null), 30_000)
    );
    imagePromiseRef.current = Promise.race([imageFetch, timeout]);
  }, []);

  const submitLocation = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    locationRef.current = text;
    setMessages((m) => [...m, { from: "user", text }, { from: "coach", text: Q2 }]);
    setDraft("");
    // Fire image generation now with the location, so it's in flight while the user types Q2.
    // We pass a stub description; will not regenerate even when message 2 arrives.
    startImageGen(text, "rehearsal preparation");
    setStep("description");
  }, [draft, startImageGen]);

  const submitDescription = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [...m, { from: "user", text }]);
    setDraft("");
    setStep("composing");

    setComposingBeat("Composing the scene.");

    const scenarioFallback: Scenario = {
      title: "An interaction the person has decided to prepare for.",
      scenePartnerLine: "Have a seat.",
      framing: "The details could not be composed. The rehearsal will proceed.",
    };
    const scenarioFetch = fetch("/api/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: locationRef.current, description: text }),
    })
      .then(async (r) => (await r.json()) as Scenario)
      .catch((): Scenario => scenarioFallback);
    // Demo safety: bound the scenario wait too.
    const scenarioTimeout = new Promise<Scenario>((resolve) =>
      setTimeout(() => resolve(scenarioFallback), 30_000)
    );
    const scenarioPromise = Promise.race([scenarioFetch, scenarioTimeout]);

    // Cycle the beat while we wait, so the wait feels intentional.
    const beats = [
      "Composing the scene.",
      "Constructing the set.",
      "Reviewing the materials.",
    ];
    let i = 0;
    const ticker = setInterval(() => {
      i = (i + 1) % beats.length;
      setComposingBeat(beats[i]);
    }, 1200);

    const [scenario, imageUrl] = await Promise.all([
      scenarioPromise,
      imagePromiseRef.current ?? Promise.resolve<string | null>(null),
    ]);
    clearInterval(ticker);
    props.onDone({ scenario, imageUrl });
  }, [draft, props]);

  const onSubmit = step === "location" ? submitLocation : submitDescription;

  return (
    <div className="w-full max-w-2xl mx-auto p-6 md:p-10 flex flex-col gap-6 min-h-screen">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
          Rehearsal — Intake
        </p>
        <h1 className="text-2xl font-semibold mt-1">
          Before we begin.
        </h1>
      </header>

      <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
              m.from === "coach"
                ? "self-start bg-neutral-900 text-neutral-100 border border-neutral-800"
                : "self-end bg-neutral-100 text-black"
            }`}
          >
            {m.text}
          </div>
        ))}
        {step === "composing" && (
          <div className="self-start max-w-[85%] rounded-lg px-4 py-3 text-sm bg-neutral-900 text-neutral-400 border border-neutral-800">
            {composingBeat}
          </div>
        )}
      </div>

      {step !== "composing" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="flex gap-2"
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={step === "location" ? "Type your answer." : "Type your answer."}
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="px-5 py-3 rounded-lg bg-neutral-100 text-black font-medium hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
