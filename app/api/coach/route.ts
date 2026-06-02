import { NextRequest, NextResponse } from "next/server";
import {
  COACH_SYSTEM_PROMPT,
  COACH_SYSTEM_PROMPT_RICH,
  buildCoachUserMessage,
} from "@/lib/coach-prompt";
import type { CoachMode } from "@/lib/coach-prompt";
import {
  stripInter1Payload,
  stripHistoryEntries,
} from "@/lib/coach-payload";
import { isMockMode } from "@/lib/mock";
import { mockCoachLine, pickFallbackCoachLine } from "@/lib/mock/coach";

/**
 * Read at request time so flipping USE_RATIONALE between dev-server starts
 * actually changes behavior. Server-only (no NEXT_PUBLIC_ prefix) — never
 * exposed to the client bundle.
 */
function shouldUseRationale(): boolean {
  return process.env.USE_RATIONALE === "true";
}

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_THRESHOLD_CQI = 75;

export async function POST(req: NextRequest) {
  let body: {
    scenario?: {
      title?: string;
      framing?: string;
      scenePartnerLine?: string;
      background?: string;
    };
    scenarioTitle?: string; // backward compat
    takeNumber?: number;
    history?: unknown;
    inter1?: unknown;
    mode?: CoachMode;
    thresholdCqi?: number;
    // Test-only: force a particular failure mode (only honoured when set).
    _forceFail?: "throw" | "non_ok" | "non_json";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const useRationale = shouldUseRationale();
  const stripOpts = { includeRationale: useRationale };
  const inter1 = stripInter1Payload(body.inter1, stripOpts);
  const history = stripHistoryEntries(body.history, stripOpts);
  const takeNumber = body.takeNumber ?? 1;
  const mode: CoachMode = body.mode === "stopping" ? "stopping" : "continuing";
  const thresholdCqi =
    typeof body.thresholdCqi === "number"
      ? body.thresholdCqi
      : DEFAULT_THRESHOLD_CQI;
  const systemPrompt = useRationale
    ? COACH_SYSTEM_PROMPT_RICH
    : COACH_SYSTEM_PROMPT;

  // MOCK_MODE: short-circuit with a canned in-register line.
  if (isMockMode()) {
    const report = mockCoachLine({
      takeNumber,
      history,
      inter1,
      mode,
      thresholdCqi,
    });
    return NextResponse.json({ report });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        report: pickFallbackCoachLine(takeNumber),
        fallback: true,
        reason: "server_misconfig",
      },
      { status: 200 }
    );
  }

  const scenario = {
    title: body.scenario?.title ?? body.scenarioTitle ?? "Unknown scenario.",
    framing: body.scenario?.framing ?? "",
    scenePartnerLine: body.scenario?.scenePartnerLine ?? "",
    background: body.scenario?.background ?? "",
  };

  const userMessage = buildCoachUserMessage({
    scenario,
    takeNumber,
    history,
    inter1,
    mode,
    thresholdCqi,
  });

  // Test-only failure injection. Honoured outside production so the fallback
  // paths can be exercised in dev/CI; ignored entirely in production so a
  // client can't shape the response by posting _forceFail.
  const forceFail =
    process.env.NODE_ENV !== "production" ? body._forceFail : undefined;

  try {
    if (forceFail === "throw") {
      throw new Error("forced failure");
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (forceFail === "non_ok" || !res.ok) {
      return NextResponse.json(
        {
          report: pickFallbackCoachLine(takeNumber),
          fallback: true,
          reason: "upstream",
        },
        { status: 200 }
      );
    }

    const text = await res.text();
    if (forceFail === "non_json") {
      return NextResponse.json(
        {
          report: pickFallbackCoachLine(takeNumber),
          fallback: true,
          reason: "upstream_non_json",
        },
        { status: 200 }
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        {
          report: pickFallbackCoachLine(takeNumber),
          fallback: true,
          reason: "upstream_non_json",
        },
        { status: 200 }
      );
    }

    const content =
      (json as { content?: Array<{ type: string; text?: string }> }).content ?? [];
    const report = content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")
      .trim();

    if (!report) {
      return NextResponse.json(
        {
          report: pickFallbackCoachLine(takeNumber),
          fallback: true,
          reason: "empty_content",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ report });
  } catch (e) {
    console.error("[coach] threw", e);
    return NextResponse.json(
      {
        report: pickFallbackCoachLine(takeNumber),
        fallback: true,
        reason: "exception",
      },
      { status: 200 }
    );
  }
}
