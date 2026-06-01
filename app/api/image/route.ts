import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { isMockMode } from "@/lib/mock";

export const runtime = "nodejs";
export const maxDuration = 120;

const FACE_DIR = resolve(process.cwd(), "scripts/fixtures/face");
const MODEL = "nano-banana-pro-preview";

function mimeFor(path: string): string {
  const e = extname(path).toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  return "image/jpeg";
}

async function loadFaceReferences(): Promise<
  Array<{ inlineData: { mimeType: string; data: string } }>
> {
  try {
    const entries = await readdir(FACE_DIR);
    const files = entries
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .map((f) => resolve(FACE_DIR, f))
      .slice(0, 4);
    return Promise.all(
      files.map(async (p) => ({
        inlineData: {
          mimeType: mimeFor(p),
          data: (await readFile(p)).toString("base64"),
        },
      }))
    );
  } catch {
    return [];
  }
}

function buildPrompt(location: string, description: string): string {
  // Composition is front-loaded so it survives the long-prompt weight decay.
  // Laptop failure mode (laptop-on-table, backpack, chest harness) is fought
  // with explicit negatives, capitalised for emphasis.
  return (
    `A wide establishing shot of ${location}. The same man as in the reference photograph stands in the FAR LEFT THIRD of the frame, SMALL within the wider view, seen full-length — an observer at the edge of the frame, not the subject of the photo. His body is turned three-quarter away. He glances back over his shoulder toward the camera with a mild, blank, slightly caught-off-guard expression, soft and a little awkward.\n\n` +
    `An open laptop hangs at waist height from a single black strap worn diagonally across his body, over one shoulder and down to the opposite hip — sash-style, like a courier-bag sling. He steadies the laptop lightly with one hand. The laptop is NOT resting on any table, desk, bench, or surface. NO backpack, NO chest harness, NO two-strap rig. The strap is visible only over one shoulder. He wears a plain grey t-shirt and dark trousers.\n\n` +
    `A large sheet of brown kraft paper is taped up on a wall or surface near him, covered in a hand-drawn flowchart of boxes and arrows, the handwriting loose and not clearly legible. A folding table holds a few scattered printed pages.\n\n` +
    `Soft, ordinary lighting suited to the environment. Deadpan, quiet, gently absurd mood. Context of the upcoming interaction being rehearsed: ${description}. Candid, naturalistic, documentary-style photograph, 35mm, natural depth of field, as if a still from an observational TV show. Lots of open space and air around the scene. Match the face in the reference photographs closely. Only one person in frame. No text overlays, no captions.`
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

  let body: { location?: string; description?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const location = (body.location ?? "").trim();
  const description = (body.description ?? "").trim();
  const overridePrompt = (body.prompt ?? "").trim();

  // If a full prompt override is supplied (used by presets that ship their
  // own scene-specific text), use it verbatim. Otherwise build from
  // location + description for the free-text path.
  let prompt: string;
  if (overridePrompt) {
    prompt = overridePrompt;
  } else {
    if (!location) {
      return NextResponse.json({ error: "missing_location" }, { status: 400 });
    }
    prompt = buildPrompt(location, description);
  }

  try {
    const refs = await loadFaceReferences();
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
            parts: [{ text: prompt }, ...refs],
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
