import { readFile, mkdir, writeFile, readdir } from "node:fs/promises";
import { extname, resolve, basename } from "node:path";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("[banner] GEMINI_API_KEY not set in environment.");
  process.exit(2);
}

const faceDir = resolve("scripts/fixtures/face");
let faceFiles: string[];
try {
  const entries = await readdir(faceDir);
  faceFiles = entries
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .map((f) => resolve(faceDir, f));
} catch {
  console.error(`[banner] no face references in ${faceDir}`);
  process.exit(2);
}

const mimeFor = (p: string): string => {
  const e = extname(p).toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  return "image/jpeg";
};

const referenceParts = await Promise.all(
  faceFiles.slice(0, 4).map(async (p) => ({
    inlineData: {
      mimeType: mimeFor(p),
      data: (await readFile(p)).toString("base64"),
    },
  }))
);

console.log(`[banner] face refs: ${faceFiles.map((f) => basename(f)).join(", ")}`);

const prompts = [
  // V1: Classic airplane wing, wide cinematic landscape
  `A wide cinematic horizontal photograph in 16:9 landscape aspect ratio. Framed through an airplane cabin window — a wide rounded-rectangle porthole. Through the window: a man stands on the wing of a commercial airplane in flight, holding an open silver laptop casually in both hands. He looks toward the camera with a flat, deadpan expression — not alarmed, just mildly out of place. Dark denim jacket, dark jeans, backpack. The wing extends to the right, blue sky with dramatic cumulus clouds, red airplane winglet visible. The man is positioned in the left third of the frame with expansive sky and wing to his right. The man is the person from the reference photographs — match his face precisely. Photorealistic, high production value, quietly surreal and deadpan. No text. No other people. Landscape 16:9.`,

  // V2: Different setting — standing at an airport gate with laptop, seen through terminal glass
  `A wide cinematic horizontal photograph in 16:9 landscape aspect ratio. A man stands alone on an empty airport tarmac at golden hour, holding an open laptop. He is small in the frame — positioned in the right third — with a massive commercial airplane behind him and an expansive empty runway stretching left. He wears a dark denim jacket, dark jeans, a backpack. His expression is flat, deadpan, mildly confused — as if he walked here by accident and decided to stay. Warm golden light, long shadows. Documentary realism, 35mm, natural depth of field. The man is the person from the reference photographs — match his face closely. Quietly absurd. No text, no overlays, no other people. Landscape 16:9.`,

  // V3: Minimalist — dark background, centered figure, laptop glow
  `A wide cinematic horizontal photograph in 16:9 landscape aspect ratio. A man stands alone in the center of a completely empty, dimly lit rehearsal room — dark gray walls, a single overhead practical light creating a pool of light around him. He holds an open laptop at chest height, the screen casting a cool blue glow on his face. His expression is deadpan, neutral, mildly serious. Dark denim jacket, dark jeans, backpack still on. Behind him on the dark wall: a large sheet of brown kraft paper with a barely-visible hand-drawn flowchart. The room is mostly darkness with just the figure illuminated. Cinematic, moody, documentary tone. The man is the person from the reference photographs — match his face precisely. No text, no other people. Landscape 16:9.`,
];

const model = "nano-banana-pro-preview";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

await mkdir(resolve("scripts/out"), { recursive: true });

for (let i = 0; i < prompts.length; i++) {
  console.log(`\n[banner] generating variant ${i + 1} of ${prompts.length}...`);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompts[i] }, ...referenceParts],
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[banner] variant ${i + 1} failed: HTTP ${res.status}`);
    console.error(text.slice(0, 500));
    continue;
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
    console.error(`[banner] variant ${i + 1}: no image in response`);
    continue;
  }

  const bytes = Buffer.from(part.inlineData.data, "base64");
  const ext = part.inlineData.mimeType.split("/").pop() ?? "png";
  const out = resolve(`scripts/out/banner-v${i + 1}.${ext}`);
  await writeFile(out, bytes);
  console.log(`[banner] variant ${i + 1} saved: ${out} (${bytes.byteLength} bytes)`);
}

console.log("\n[banner] done.");
