import { NextRequest, NextResponse } from "next/server";
import { COACH_SYSTEM_PROMPT, buildCoachUserMessage } from "@/lib/coach-prompt";
import type { CoachMode } from "@/lib/coach-prompt";
import {
  stripInter1Payload,
  stripHistoryEntries,
} from "@/lib/coach-payload";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_THRESHOLD_CQI = 75;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "server_misconfig", message: "ANTHROPIC_API_KEY not set" },
      { status: 500 }
    );
  }

  let body: {
    scenario?: { title?: string; framing?: string; scenePartnerLine?: string };
    scenarioTitle?: string; // backward compat
    takeNumber?: number;
    history?: unknown;
    inter1?: unknown;
    mode?: CoachMode;
    thresholdCqi?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const scenario = {
    title: body.scenario?.title ?? body.scenarioTitle ?? "Unknown scenario.",
    framing: body.scenario?.framing ?? "",
    scenePartnerLine: body.scenario?.scenePartnerLine ?? "",
  };

  const userMessage = buildCoachUserMessage({
    scenario,
    takeNumber: body.takeNumber ?? 1,
    history: stripHistoryEntries(body.history),
    inter1: stripInter1Payload(body.inter1),
    mode: body.mode === "stopping" ? "stopping" : "continuing",
    thresholdCqi:
      typeof body.thresholdCqi === "number"
        ? body.thresholdCqi
        : DEFAULT_THRESHOLD_CQI,
  });

  try {
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
        system: COACH_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "upstream_non_json", body: text.slice(0, 500) },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: "upstream", upstream: json },
        { status: res.status }
      );
    }

    const content =
      (json as { content?: Array<{ type: string; text?: string }> }).content ?? [];
    const report = content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")
      .trim();

    return NextResponse.json({ report });
  } catch (e) {
    console.error("[coach] threw", e);
    return NextResponse.json(
      {
        report:
          "The assessment could not be retrieved. We will continue without it.",
      },
      { status: 200 }
    );
  }
}
