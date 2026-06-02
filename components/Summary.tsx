"use client";

import { useEffect, useRef, useState } from "react";
import type { Scenario } from "@/lib/scenario";
import type { Take } from "@/lib/session";
import Curve from "./Curve";
import TypedText from "./TypedText";
import ProceduralBackdrop from "./ProceduralBackdrop";
import { isMockMode } from "@/lib/mock";
import { fetchWithTimeout } from "@/lib/fetch-timeout";

export default function Summary({
  scenario,
  takes,
  setImageUrl,
  onNewSession,
}: {
  scenario: Scenario;
  takes: Take[];
  setImageUrl: string | null;
  onNewSession: () => void;
}) {
  const [report, setReport] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [composing, setComposing] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    const last = takes[takes.length - 1];
    void (async () => {
      let reportText = "The session has concluded. The record will be retained.";
      try {
        const r = await fetchWithTimeout(
          "/api/coach",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scenario,
              takeNumber: last?.takeNumber ?? takes.length,
              history: takes.slice(0, -1).map((t) => ({
                takeNumber: t.takeNumber,
                signals: t.signals,
                engagement: t.engagement,
                cqiOverall: t.cqiOverall,
                advice: t.advice,
              })),
              inter1: {
                signals: last?.signals ?? [],
                engagement_state: last?.engagement,
                conversation_quality: last?.cqi,
              },
              mode: "stopping",
            }),
          },
          30_000
        );
        const j = (await r.json()) as { report?: string };
        if (j.report?.trim()) reportText = j.report.trim();
      } catch (coachErr) {
        console.warn("[summary coach] fell back:", coachErr);
      }
      setReport(reportText);

      // TTS isolated so a timeout does not block the final assessment display.
      try {
        const t = await fetchWithTimeout(
          "/api/tts",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: reportText }),
          },
          20_000
        );
        if (t.ok) {
          const blob = await t.blob();
          const url = URL.createObjectURL(blob);
          audioUrlRef.current = url;
          setAudioUrl(url);
        }
      } catch (ttsErr) {
        console.warn("[summary tts] skipped:", ttsErr);
      }
      setComposing(false);
    })();
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Play the voiceover once the audio is actually ready. The coach + TTS
  // round-trips take several seconds, by which point a single eager play() is
  // often rejected by the browser's autoplay policy. Gate on the media being
  // playable and also retry on canplay, mirroring the Recorder's approach.
  useEffect(() => {
    if (!audioUrl) return;
    const a = audioRef.current;
    if (!a) return;

    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      a.currentTime = 0;
      a.play().catch(() => {});
    };

    if (a.readyState >= 2 /* HAVE_CURRENT_DATA */) {
      start();
    } else {
      a.addEventListener("canplay", start, { once: true });
    }
    return () => {
      cancelled = true;
      a.removeEventListener("canplay", start);
    };
  }, [audioUrl]);

  return (
    <div className="w-full max-w-4xl mx-auto p-6 md:p-10 space-y-5">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500">
          End of session
        </p>
        <h1 className="text-2xl md:text-3xl font-semibold mt-2 leading-tight tracking-tight">
          {scenario.title}
        </h1>
        <p className="text-sm text-neutral-400 mt-3 font-mono">
          {takes.length === 1
            ? "01 rehearsal completed."
            : `${String(takes.length).padStart(2, "0")} rehearsals completed.`}
        </p>
      </header>

      {setImageUrl ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={setImageUrl}
            alt={`A photograph of the rehearsal set composed for the scenario: ${scenario.title}`}
            className="w-full h-auto object-cover"
          />
        </div>
      ) : isMockMode() ? (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 overflow-hidden aspect-[4/3]">
          <ProceduralBackdrop scenarioTitle={scenario.title} />
        </div>
      ) : null}

      <Curve takes={takes} />

      <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-6 md:p-8 min-h-[130px]">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500 mb-4">
          Final assessment
        </p>
        {composing ? (
          <p className="text-neutral-400">Composing the closing remarks.</p>
        ) : (
          <p className="text-neutral-100 text-[15px] leading-[1.75]">
            <TypedText text={report ?? ""} />
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onNewSession}
          className="px-5 py-2.5 rounded bg-neutral-100 text-black font-medium hover:bg-white"
        >
          Begin a new scenario
        </button>
        {audioUrl && (
          <button
            onClick={() => {
              const a = audioRef.current;
              if (a) {
                a.currentTime = 0;
                a.play().catch(() => {});
              }
            }}
            className="px-4 py-2 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-900"
          >
            Play the assessment
          </button>
        )}
      </div>

      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} className="hidden" preload="auto" />
      )}
    </div>
  );
}
