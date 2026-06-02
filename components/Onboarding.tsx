"use client";

import { useCallback, useRef, useState } from "react";
import type { Scenario } from "@/lib/scenario";
import Masthead from "./Masthead";

type Step = "scene" | "description" | "composing";

type Msg = { from: "coach" | "user"; text: string };

const Q1 =
  "Where does this rehearsal take place, and who is your scene partner. Describe them.";
const Q2 = "Now describe what you are rehearsing. Be specific.";

const SCENARIO_FALLBACK: Scenario = {
  title: "An interaction the person has decided to prepare for.",
  scenePartnerLine: "Have a seat.",
  framing: "The details could not be composed. The rehearsal will proceed.",
};

export default function Onboarding(props: {
  onDone: (result: { scenario: Scenario; imageUrl: string | null }) => void;
}) {
  const [step, setStep] = useState<Step>("scene");
  const [messages, setMessages] = useState<Msg[]>([{ from: "coach", text: Q1 }]);
  const [draft, setDraft] = useState("");
  const [composingBeat, setComposingBeat] = useState<string>("Composing the scene.");
  const imagePromiseRef = useRef<Promise<string | null> | null>(null);
  const sceneRef = useRef<string>("");

  const startImageGen = useCallback((scene: string) => {
    const imageFetch = fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene }),
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

  const cycleBeatsWhile = useCallback(
    async <T,>(work: Promise<T>): Promise<T> => {
      setComposingBeat("Composing the scene.");
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
      try {
        return await work;
      } finally {
        clearInterval(ticker);
      }
    },
    []
  );

  const submitScene = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    sceneRef.current = text;
    setMessages((m) => [...m, { from: "user", text }, { from: "coach", text: Q2 }]);
    setDraft("");
    // Fire image generation now that we have the scene + partner, so it's in
    // flight while the user types the final answer.
    startImageGen(text);
    setStep("description");
  }, [draft, startImageGen]);

  const submitDescription = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [...m, { from: "user", text }]);
    setDraft("");
    setStep("composing");

    const scenarioFetch = fetch("/api/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scene: sceneRef.current,
        description: text,
      }),
    })
      .then(async (r) => (await r.json()) as Scenario)
      .catch((): Scenario => SCENARIO_FALLBACK);
    const scenarioTimeout = new Promise<Scenario>((resolve) =>
      setTimeout(() => resolve(SCENARIO_FALLBACK), 30_000)
    );
    const scenarioPromise = Promise.race([scenarioFetch, scenarioTimeout]);

    const result = await cycleBeatsWhile(
      Promise.all([
        scenarioPromise,
        imagePromiseRef.current ?? Promise.resolve<string | null>(null),
      ])
    );
    const [scenario, imageUrl] = result;
    props.onDone({ scenario, imageUrl });
  }, [draft, props, cycleBeatsWhile]);

  const onSubmit = step === "scene" ? submitScene : submitDescription;

  return (
    <div className="w-full max-w-2xl mx-auto p-6 md:p-10 flex flex-col gap-6 min-h-screen">
      <header>
        <Masthead className="mb-4" />
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500">
          Rehearsal — Intake
        </p>
        <h1 className="text-2xl font-semibold mt-2 leading-tight tracking-tight">
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
            placeholder="Type your answer."
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
