"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Scenario } from "@/lib/scenario";
import {
  stripInter1Payload,
  type StrippedInter1,
} from "@/lib/coach-payload";
import { THRESHOLD_CQI, type Take } from "@/lib/session";
import { isMockMode } from "@/lib/mock";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import Curve from "./Curve";
import TypedText from "./TypedText";
import ProceduralBackdrop from "./ProceduralBackdrop";
import Masthead from "./Masthead";

type Status =
  | "idle"
  | "permission-denied"
  | "recording"
  | "analyzing"
  | "composing"
  | "voicing"
  | "playback"
  | "error";

const ANALYSIS_BEATS: Record<Status, string> = {
  idle: "",
  "permission-denied": "",
  recording: "Recording.",
  analyzing: "Analyzing the take.",
  composing: "Composing the assessment.",
  voicing: "Voicing the assessment.",
  playback: "",
  error: "",
};

function pickWebmMime(): string {
  const opts = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const m of opts) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m))
      return m;
  }
  return "";
}

export default function Recorder(props: {
  scenario: Scenario;
  setImageUrl: string | null;
  takes: Take[];
  onTakeComplete: (take: Take) => void;
  onQuit: () => void;
  onRestart: () => void;
}) {
  const { scenario, setImageUrl, takes, onTakeComplete, onQuit, onRestart } =
    props;
  // The take being set up / recorded right now. Used for "Begin take N", the
  // file name, and the analyze call — all of which run before the take is
  // committed to history.
  const takeNumber = takes.length + 1;

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [report, setReport] = useState<string | null>(null);
  const [replayUrl, setReplayUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentStripped, setCurrentStripped] = useState<StrippedInter1 | null>(
    null
  );

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const replayVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const analyzeRef = useRef<((blob: Blob) => void) | null>(null);

  const ensureStream = useCallback(async (): Promise<MediaStream | null> => {
    if (streamRef.current) return streamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (liveVideoRef.current) liveVideoRef.current.srcObject = stream;
      return stream;
    } catch (e) {
      setErrorMessage(
        "Camera or microphone access was denied. The rehearsal cannot begin."
      );
      setStatus("permission-denied");
      console.error(e);
      return null;
    }
  }, []);

  useEffect(() => {
    ensureStream();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (tickRef.current !== null) cancelAnimationFrame(tickRef.current);
      if (replayUrl) URL.revokeObjectURL(replayUrl);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When playback begins, start video and the voiceover together. MediaRecorder
  // webm blobs often report no/Infinite duration until they've loaded, so
  // seeking to 0 before the video is ready can be silently ignored — gate the
  // start on the video being playable so the voiceover lands over the footage
  // rather than drifting ahead of it.
  useEffect(() => {
    if (status !== "playback") return;
    const v = replayVideoRef.current;
    const a = audioRef.current; // may be null when TTS was skipped

    let cancelled = false;

    // Drive each medium off its OWN readiness. The voiceover must not be gated
    // on the video: on a re-take the <video> element can already be past
    // `loadeddata`, so a video-only listener never fires again and the audio is
    // left orphaned (the bug). Mirror Summary's per-element canplay gate.
    const startVideo = () => {
      if (cancelled || !v) return;
      try {
        v.currentTime = 0;
      } catch {
        // duration not yet known; play() will start from 0 anyway
      }
      v.muted = true;
      v.play().catch(() => {});
    };
    const startAudio = () => {
      if (cancelled || !a) return;
      a.currentTime = 0;
      a.play().catch(() => {});
    };

    if (v) {
      if (v.readyState >= 2 /* HAVE_CURRENT_DATA */) startVideo();
      else v.addEventListener("loadeddata", startVideo, { once: true });
    }
    if (a) {
      if (a.readyState >= 2) startAudio();
      else a.addEventListener("canplay", startAudio, { once: true });
    }

    return () => {
      cancelled = true;
      if (v) v.removeEventListener("loadeddata", startVideo);
      if (a) a.removeEventListener("canplay", startAudio);
    };
  }, [status, replayUrl, audioUrl]);

  const tick = useCallback(() => {
    setElapsedMs(Date.now() - startedAtRef.current);
    tickRef.current = requestAnimationFrame(tick);
  }, []);

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    setReport(null);
    setCurrentStripped(null);
    if (replayUrl) {
      URL.revokeObjectURL(replayUrl);
      setReplayUrl(null);
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    const stream = await ensureStream();
    if (!stream) return;

    const mimeType = pickWebmMime();
    let rec: MediaRecorder;
    try {
      rec = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch (e) {
      console.error(e);
      setErrorMessage("This browser does not support recording.");
      setStatus("error");
      return;
    }
    chunksRef.current = [];
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    rec.onstop = () => {
      if (tickRef.current !== null) cancelAnimationFrame(tickRef.current);
      const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
      // Use latest analyze via ref so the closure isn't stale across takes.
      analyzeRef.current?.(blob);
    };
    recorderRef.current = rec;
    rec.start(1000);
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    tickRef.current = requestAnimationFrame(tick);
    setStatus("recording");
  }, [ensureStream, replayUrl, audioUrl, tick]);

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const analyze = useCallback(
    async (blob: Blob) => {
      try {
        setStatus("analyzing");

        const form = new FormData();
        const ext = blob.type.includes("mp4") ? "mp4" : "webm";
        form.append("file", blob, `take-${takeNumber}.${ext}`);
        form.append("takeNumber", String(takeNumber));
        const r1 = await fetchWithTimeout(
          "/api/analyze",
          { method: "POST", body: form },
          60_000
        );
        if (!r1.ok) throw new Error(`analyze failed: ${r1.status}`);
        const inter1Raw = await r1.json();
        // Lean strip for the HUD (type/time only). Rich strip keeps rationale +
        // probability so the stored take — and thus the cross-take history and
        // the Summary's final assessment — still has the quoted speech to work
        // with. The coach server re-strips per USE_RATIONALE either way.
        const stripped = stripInter1Payload(inter1Raw);
        const strippedRich = stripInter1Payload(inter1Raw, {
          includeRationale: true,
        });
        setCurrentStripped(stripped);

        // Build history payload from prior takes.
        const historyForCoach = takes.map((t) => ({
          takeNumber: t.takeNumber,
          signals: t.signals,
          engagement: t.engagement,
          cqiOverall: t.cqiOverall,
          advice: t.advice,
        }));

        setStatus("composing");
        const r2 = await fetchWithTimeout(
          "/api/coach",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scenario,
              takeNumber,
              history: historyForCoach,
              // Send the raw payload so the server can decide whether to keep
              // rationale/probability based on USE_RATIONALE. Stripping on the
              // client would discard the quoted speech the rich coach needs.
              inter1: inter1Raw,
              mode: "continuing",
              thresholdCqi: THRESHOLD_CQI,
            }),
          },
          30_000
        );
        if (!r2.ok) throw new Error(`coach failed: ${r2.status}`);
        const { report: reportText } = (await r2.json()) as { report: string };

        // TTS is optional — isolate its failure so a timeout or network drop
        // does NOT lose the report we already have in hand.
        setStatus("voicing");
        let nextAudioUrl: string | null = null;
        try {
          const r3 = await fetchWithTimeout(
            "/api/tts",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: reportText }),
            },
            20_000
          );
          if (r3.ok) {
            const audioBlob = await r3.blob();
            nextAudioUrl = URL.createObjectURL(audioBlob);
          }
        } catch (ttsErr) {
          console.warn("[tts] skipped:", ttsErr);
        }

        const nextReplayUrl = URL.createObjectURL(blob);
        setReplayUrl(nextReplayUrl);
        setAudioUrl(nextAudioUrl);
        setReport(reportText);

        // Commit the take to history. Store the rich signals (with rationale)
        // so the Summary's final assessment and cross-take history retain the
        // quoted speech.
        const cqiOverall = stripped.conversation_quality?.overall?.quality_index;
        const take: Take = {
          takeNumber,
          signals: strippedRich.signals,
          engagement: stripped.engagement_state,
          cqi: stripped.conversation_quality,
          cqiOverall: typeof cqiOverall === "number" ? cqiOverall : undefined,
          advice: reportText,
          recordedAt: Date.now(),
        };
        onTakeComplete(take);

        setStatus("playback");
      } catch (e) {
        console.error(e);
        setErrorMessage(
          "The assessment could not be completed. The rehearsal will pause."
        );
        setStatus("error");
      }
    },
    [takeNumber, scenario, takes, onTakeComplete]
  );

  // Keep the ref pointed at the latest analyze so startRecording's closure is fresh.
  useEffect(() => {
    analyzeRef.current = analyze;
  }, [analyze]);

  const nextTake = useCallback(() => {
    setReport(null);
    setCurrentStripped(null);
    if (replayUrl) URL.revokeObjectURL(replayUrl);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setReplayUrl(null);
    setAudioUrl(null);
    setStatus("idle");
  }, [replayUrl, audioUrl]);

  const beat = ANALYSIS_BEATS[status];
  const thresholdReached =
    typeof currentStripped?.conversation_quality?.overall?.quality_index ===
      "number" &&
    (currentStripped.conversation_quality.overall.quality_index ?? 0) >=
      THRESHOLD_CQI;

  return (
    <div className="w-full max-w-7xl mx-auto p-6 md:p-10 space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Masthead className="mb-4" />
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500">
            Rehearsal №{" "}
            <span className="text-neutral-300">
              {String(status === "playback" ? takes.length : takeNumber).padStart(2, "0")}
            </span>
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold mt-2 leading-tight tracking-tight">
            {scenario.title}
          </h1>
        </div>
        <div className="flex items-center gap-4 self-start">
          {takes.length > 0 && (
            <button
              onClick={onQuit}
              aria-label="End the rehearsal session and view the summary"
              className="text-xs text-neutral-500 hover:text-neutral-300 whitespace-nowrap"
            >
              end the session
            </button>
          )}
          <button
            onClick={() => {
              if (
                takes.length === 0 ||
                window.confirm(
                  "Discard this session and start over from the beginning?"
                )
              ) {
                onRestart();
              }
            }}
            aria-label="Discard this session and start a new scenario"
            className="text-xs text-neutral-500 hover:text-neutral-300 whitespace-nowrap"
          >
            start over
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Set image */}
        <div className="aspect-video rounded-lg border border-neutral-800 bg-neutral-950 overflow-hidden relative">
          {setImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={setImageUrl}
              alt={`A photograph of the rehearsal set composed for the scenario: ${scenario.title}`}
              className="w-full h-full object-cover"
            />
          ) : isMockMode() ? (
            <ProceduralBackdrop scenarioTitle={scenario.title} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <p className="text-neutral-500 text-xs leading-relaxed">
                The set could not be constructed.
                <br />
                We proceed without it.
              </p>
            </div>
          )}
        </div>

        {/* Webcam + corner signal panel */}
        <div className="aspect-video relative rounded-lg border border-neutral-800 bg-black overflow-hidden">
          <video
            ref={liveVideoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover ${
              status === "playback" ? "hidden" : "block"
            }`}
          />
          {replayUrl && (
            <video
              ref={replayVideoRef}
              src={replayUrl}
              playsInline
              className={`absolute inset-0 w-full h-full object-cover ${
                status === "playback" ? "block" : "hidden"
              }`}
            />
          )}
          {status === "recording" && (
            <div className="absolute top-3 left-3 flex items-center gap-2 px-2 py-1 rounded bg-black/70 font-mono text-[11px] tracking-wider">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>{(elapsedMs / 1000).toFixed(1)}s</span>
            </div>
          )}
          {(status === "analyzing" ||
            status === "composing" ||
            status === "voicing") && (
            <div
              className="absolute inset-0 bg-black/80 flex items-center justify-center"
              role="status"
              aria-live="polite"
            >
              <div className="text-center space-y-3">
                <p className="text-neutral-200 text-lg">{beat}</p>
                <p className="font-mono text-neutral-600 text-[11px] uppercase tracking-[0.25em]">
                  Please wait.
                </p>
              </div>
            </div>
          )}
          <SignalPanel inter1={currentStripped} visible={status === "playback"} />
        </div>
      </div>

      {/* Scene partner line */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500 mb-2">
          Scene partner
        </p>
        <p className="text-neutral-200 leading-relaxed">
          &ldquo;{scenario.scenePartnerLine}&rdquo;
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {status === "idle" && (
          <button
            onClick={startRecording}
            className="px-5 py-2.5 rounded bg-neutral-100 text-black font-medium hover:bg-white"
          >
            Begin take {takeNumber}
          </button>
        )}
        {status === "recording" && (
          <button
            onClick={stopRecording}
            className="px-5 py-2.5 rounded bg-red-600 text-white font-medium hover:bg-red-500"
          >
            End take
          </button>
        )}
        {status === "playback" && (
          <>
            <button
              onClick={nextTake}
              className="px-5 py-2.5 rounded bg-neutral-100 text-black font-medium hover:bg-white"
            >
              Rehearse again
            </button>
            <button
              onClick={onQuit}
              className={`px-4 py-2 rounded border ${
                thresholdReached
                  ? "border-neutral-300 text-neutral-100 hover:bg-neutral-900"
                  : "border-neutral-700 text-neutral-400 hover:bg-neutral-900"
              }`}
            >
              {thresholdReached ? "Stop here. You may." : "Stop here"}
            </button>
            {audioUrl && (
              <button
                onClick={() => {
                  const v = replayVideoRef.current;
                  const a = audioRef.current;
                  if (v) {
                    v.currentTime = 0;
                    v.play().catch(() => {});
                  }
                  if (a) {
                    a.currentTime = 0;
                    a.play().catch(() => {});
                  }
                }}
                className="px-4 py-2 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-900"
              >
                Replay
              </button>
            )}
          </>
        )}
        {(status === "error" || status === "permission-denied") && (
          <button
            onClick={() => {
              setStatus("idle");
              setErrorMessage(null);
            }}
            className="px-5 py-2.5 rounded border border-neutral-700 text-neutral-200 hover:bg-neutral-900"
          >
            Try again
          </button>
        )}
      </div>

      {errorMessage && (
        <p className="text-sm text-neutral-400">{errorMessage}</p>
      )}

      {/* Report card with typing animation */}
      {report && status === "playback" && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-6 md:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500 mb-4">
            Rehearsal Report —{" "}
            <span className="text-neutral-300">
              take {String(takes.length).padStart(2, "0")}
            </span>
          </p>
          <p className="text-neutral-100 text-[15px] leading-[1.75]">
            <TypedText text={report} />
          </p>
        </div>
      )}

      {takes.length >= 1 && status === "playback" && <Curve takes={takes} />}

      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} className="hidden" preload="auto" />
      )}
    </div>
  );
}

function SignalPanel({
  inter1,
  visible,
}: {
  inter1: StrippedInter1 | null;
  visible: boolean;
}) {
  if (!visible || !inter1) return null;
  const cqi = inter1.conversation_quality?.overall?.quality_index;
  const signals = inter1.signals.slice(0, 6);
  return (
    <div className="absolute bottom-3 right-3 w-[46%] max-w-[280px] rounded-md bg-black/85 border border-neutral-700 backdrop-blur-sm p-3.5 font-mono text-[11px] leading-snug">
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-neutral-800">
        <span className="uppercase tracking-[0.25em] text-neutral-500">Signals</span>
        {typeof cqi === "number" && (
          <span className="text-neutral-300">
            CQI <span className="text-neutral-100">{cqi.toFixed(0)}</span>
          </span>
        )}
      </div>
      {signals.length === 0 ? (
        <p className="text-neutral-500">None detected.</p>
      ) : (
        <ul className="space-y-1">
          {signals.map((s, i) => (
            <li key={i} className="flex justify-between text-neutral-300">
              <span>{s.type}</span>
              <span className="text-neutral-500">
                {s.start.toFixed(0)}–{s.end.toFixed(0)}s
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
