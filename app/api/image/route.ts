import { NextRequest, NextResponse } from "next/server";
import { isMockMode } from "@/lib/mock";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = "nano-banana-pro-preview";

function buildPrompt(scene: string): string {
  // The image is the scene partner — the person being rehearsed against —
  // shot point-of-view, as if the viewer is standing across from them mid
  // conversation. The single `scene` input describes both who the partner is
  // and where the conversation happens. The subject framing is front-loaded so
  // it survives long-prompt weight decay.
  return (
    `A candid, naturalistic point-of-view portrait based on this description: ${scene}.\n\n` +
    `Render the SCENE PARTNER (the person described) in the NEAR FOREGROUND, close to the camera, at a natural conversational distance, FACING THE VIEWER DIRECTLY and making eye contact — as though mid-conversation with the person holding the camera. Their posture and expression are ordinary and attentive, as if they have just been spoken to and are waiting to respond. Eye level, point-of-view shot, framed from roughly the chest up.\n\n` +
    `Place the described setting behind and around them but softly out of focus with natural shallow depth of field, so the person remains the clear subject. Soft, ordinary lighting suited to the environment. Deadpan, quiet, gently mundane mood.\n\n` +
    `Photorealistic documentary-style photograph, 35mm, shallow depth of field, as if a still from an observational TV show shot from across a conversation. Only this one person in frame. Do NOT include the viewer or any second person. No text overlays, no captions, no on-screen graphics.`
  );
}

export async function POST(req: NextRequest) {
  if (isMockMode()) {
    // In MOCK_MODE the client renders a procedural SVG backdrop. We return
    // null so the client falls back to that path without rendering the
    // "set could not be constructed" copy.
    return NextResponse.json({ image: null, procedural: true });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "server_misconfig", message: "GEMINI_API_KEY not set" },
      { status: 500 }
    );
  }

  let body: { scene?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const scene = (body.scene ?? "").trim();
  const overridePrompt = (body.prompt ?? "").trim();

  // If a full prompt override is supplied, use it verbatim. Otherwise build
  // from the combined scene + scene-partner description.
  let prompt: string;
  if (overridePrompt) {
    prompt = overridePrompt;
  } else {
    if (!scene) {
      return NextResponse.json({ error: "missing_scene" }, { status: 400 });
    }
    prompt = buildPrompt(scene);
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(
      apiKey
    )}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[image] upstream", res.status, text.slice(0, 500));
      return NextResponse.json(
        { error: "upstream", status: res.status },
        { status: 502 }
      );
    }

    const json = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ inlineData?: { mimeType: string; data: string } }>;
        };
      }>;
    };
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part?.inlineData) {
      return NextResponse.json(
        { error: "no_image_in_response" },
        { status: 502 }
      );
    }
    const dataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    return NextResponse.json({ image: dataUrl });
  } catch (e) {
    console.error("[image] threw", e);
    return NextResponse.json({ error: "exception" }, { status: 502 });
  }
}
