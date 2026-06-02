import { NextRequest, NextResponse } from "next/server";
import { isMockMode } from "@/lib/mock";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (isMockMode()) {
    // No audio in MOCK_MODE. The Recorder treats this as a benign TTS skip
    // and shows the report text alone.
    return NextResponse.json({ skipped: "mock_mode" }, { status: 503 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    return NextResponse.json(
      { error: "server_misconfig", message: "ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID not set" },
      { status: 500 }
    );
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "empty_text" }, { status: 400 });

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
      }),
    }
  );

  if (!res.ok) {
    const t = await res.text();
    console.error(`[tts] upstream ${res.status}: ${t.slice(0, 500)}`);
    return NextResponse.json({ error: "upstream" }, { status: 502 });
  }

  const ab = await res.arrayBuffer();
  return new NextResponse(ab, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
