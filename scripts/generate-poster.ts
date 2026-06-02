import { readFile, mkdir, writeFile, readdir } from "node:fs/promises";
import { extname, resolve, basename } from "node:path";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("[poster] GEMINI_API_KEY not set in environment.");
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
  console.error(`[poster] no face references in ${faceDir}`);
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

console.log(`[poster] face refs: ${faceFiles.map((f) => basename(f)).join(", ")}`);

const prompts = [
  // Variant 1: faithful to the airplane-wing poster composition
  `A promotional poster-style photograph. The entire image is framed as if viewed through an airplane cabin window — a rounded-rectangle porthole shape with a thick gray metallic border. Through the window: a man stands impossibly on the wing of a commercial airplane in flight. He holds an open silver laptop in both hands at chest height, looking slightly to his right with a flat, deadpan, mildly confused expression. He wears a dark blue denim jacket over a dark shirt, dark indigo jeans, gray sneakers, and a black backpack. The airplane wing is white/silver, stretching out to the right. A red airplane tail/winglet is visible. Bright blue sky with large cumulus clouds. The man is the person shown in the reference photographs — match his face closely. Surreal, absurd, deadpan mood. High production value. Photorealistic. No text overlays. No captions. No other people. Portrait orientation, 2:3 aspect ratio.`,

  // Variant 2: slightly different angle/mood
  `A cinematic promotional photograph framed through an airplane window (rounded porthole shape, thick gray-silver metallic rim). Through the window we see a man standing alone on an airplane wing mid-flight, holding an open laptop casually, as if this is a perfectly normal place to check email. He looks directly at the camera with a mild, blank, slightly caught-off-guard expression — not alarmed, just faintly out of place. Dark denim jacket, dark jeans, sneakers, a backpack. The wing extends behind him, white clouds below and blue sky above. A commercial airplane tail visible in the background. The man is the person from the reference photographs — match his face precisely. The tone is quietly surreal and deadpan. Photorealistic, high-quality poster composition. No text, no overlays, no other people. Portrait aspect 2:3.`,
];

const model = "nano-banana-pro-preview";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

await mkdir(resolve("scripts/out"), { recursive: true });

for (let i = 0; i < prompts.length; i++) {
  console.log(`\n[poster] generating variant ${i + 1}...`);

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
    console.error(`[poster] variant ${i + 1} failed: HTTP ${res.status}`);
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
    console.error(`[poster] variant ${i + 1}: no image in response`);
    continue;
  }

  const bytes = Buffer.from(part.inlineData.data, "base64");
  const ext = part.inlineData.mimeType.split("/").pop() ?? "png";
  const out = resolve(`scripts/out/poster-v${i + 1}.${ext}`);
  await writeFile(out, bytes);
  console.log(`[poster] variant ${i + 1} saved: ${out} (${bytes.byteLength} bytes)`);
}

console.log("\n[poster] done.");
