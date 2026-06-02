"use client";

import { useState } from "react";
import type { Take } from "@/lib/session";
import { THRESHOLD_CQI } from "@/lib/session";
import {
  buildTakeTimelines,
  cqiFace,
  type TimelineSignal,
} from "@/lib/curve-data";
import { signalColor } from "@/lib/signal-colors";

const LANE_H = 18; // px per signal lane
const LANE_GAP = 3;

export default function Curve({ takes }: { takes: Take[] }) {
  if (takes.length === 0) return null;

  const timelines = buildTakeTimelines(takes);
  const present = Array.from(
    new Set(takes.flatMap((t) => t.signals.map((s) => s.type)))
  ).sort();

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-neutral-500 mb-1">
        Signal timeline
      </p>
      <p className="text-[11px] text-neutral-600 mb-4 leading-relaxed">
        Each row is one rehearsal. Colored blocks mark when the model detected a
        signal. Hover a block for detail. The score is the take&rsquo;s overall
        quality; {THRESHOLD_CQI} is adequate.
      </p>

      <div className="space-y-3">
        {timelines.map((tl) => {
          const lanes = tl.signals.length
            ? Math.max(...tl.signals.map((s) => s.lane)) + 1
            : 1;
          const trackH = lanes * LANE_H + (lanes - 1) * LANE_GAP;
          return (
            <div key={tl.takeNumber} className="flex items-stretch gap-3">
              {/* Take label + score face */}
              <div className="w-20 shrink-0 flex flex-col justify-center font-mono text-[11px] leading-tight">
                <span className="text-neutral-400">
                  take {String(tl.takeNumber).padStart(2, "0")}
                </span>
                <span className="text-neutral-500">
                  {tl.cqi != null ? Math.round(tl.cqi) : "--"}{" "}
                  <span
                    className={
                      tl.cqi == null
                        ? "text-neutral-600"
                        : tl.cqi >= THRESHOLD_CQI
                          ? "text-emerald-400/90"
                          : tl.cqi >= 50
                            ? "text-amber-400/90"
                            : "text-red-400/90"
                    }
                  >
                    {cqiFace(tl.cqi)}
                  </span>
                </span>
              </div>

              {/* Timeline track */}
              <div
                className="relative flex-1 rounded bg-neutral-900/70 border border-neutral-800"
                style={{ height: trackH }}
              >
                {tl.signals.length === 0 && (
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-neutral-600">
                    no signals detected
                  </span>
                )}
                {tl.signals.map((s, i) => (
                  <SignalBlock
                    key={i}
                    signal={s}
                    duration={tl.duration}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend of the signal types that actually appeared */}
      {present.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 font-mono text-[10px] text-neutral-500">
          {present.map((type) => (
            <span key={type} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ background: signalColor(type) }}
              />
              {type}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SignalBlock({
  signal,
  duration,
}: {
  signal: TimelineSignal;
  duration: number;
}) {
  const [hover, setHover] = useState(false);
  const left = (signal.start / duration) * 100;
  const width = Math.max(2, ((signal.end - signal.start) / duration) * 100);
  const color = signalColor(signal.type);

  return (
    <div
      className="absolute rounded-sm cursor-default transition-opacity"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        top: signal.lane * (LANE_H + LANE_GAP),
        height: LANE_H,
        background: color,
        opacity: hover ? 1 : 0.82,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span className="block px-1.5 font-mono text-[10px] leading-[18px] text-black/80 truncate">
        {signal.type}
      </span>

      {hover && (
        <div className="absolute z-10 bottom-full left-0 mb-1.5 w-64 rounded-md border border-neutral-700 bg-black/95 p-3 font-mono text-[11px] leading-snug shadow-xl">
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="uppercase tracking-[0.15em] font-semibold"
              style={{ color }}
            >
              {signal.type}
            </span>
            <span className="text-neutral-500">
              {signal.start.toFixed(1)}–{signal.end.toFixed(1)}s
            </span>
          </div>
          {signal.probability && (
            <p className="text-neutral-400 mb-1">
              probability:{" "}
              <span className="text-neutral-200">{signal.probability}</span>
            </p>
          )}
          {signal.rationale ? (
            <p className="text-neutral-300 leading-relaxed">
              {signal.rationale}
            </p>
          ) : (
            <p className="text-neutral-600">No further detail recorded.</p>
          )}
        </div>
      )}
    </div>
  );
}
