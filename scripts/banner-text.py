"""
Overlay "The Rehearsing" + "An Interhuman AI Production" on horizontal banner variants.
Small, clean, no backing panel. Positioned in the upper sky area.
Green serif title.
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

SCRIPTS_OUT = Path(__file__).parent / "out"

FONT_TITLE = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
FONT_THE = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
FONT_SUBTITLE = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

TITLE_COLOR = (0, 100, 55, 255)
TITLE_COLOR_LIGHT = (20, 140, 80, 255)

variants = ["banner-v1.jpeg", "banner-v2.jpeg", "banner-v3.jpeg"]

for variant in variants:
    src = SCRIPTS_OUT / variant
    if not src.exists():
        print(f"[text] skipping {variant} — not found")
        continue

    img = Image.open(src).convert("RGBA")
    w, h = img.size

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Much smaller text — about 8% of image height for the main title
    main_size = int(h * 0.09)
    the_size = int(main_size * 0.5)
    sub_size = int(h * 0.032)

    font_main = ImageFont.truetype(FONT_TITLE, main_size)
    font_the = ImageFont.truetype(FONT_THE, the_size)
    font_sub = ImageFont.truetype(FONT_SUBTITLE, sub_size)

    the_text = "The"
    main_text = "Rehearsing"
    sub_text = "AN INTERHUMAN AI PRODUCTION"

    # Measure
    the_bbox = draw.textbbox((0, 0), the_text, font=font_the)
    the_w = the_bbox[2] - the_bbox[0]
    the_h = the_bbox[3] - the_bbox[1]

    main_bbox = draw.textbbox((0, 0), main_text, font=font_main)
    main_w = main_bbox[2] - main_bbox[0]
    main_h = main_bbox[3] - main_bbox[1]

    sub_bbox = draw.textbbox((0, 0), sub_text, font=font_sub)
    sub_w = sub_bbox[2] - sub_bbox[0]

    # Position: upper-right area, in the sky
    right_pad = int(w * 0.05)
    top_pad = int(h * 0.08)

    # Right-align the main title
    main_x = w - main_w - right_pad
    the_x = main_x  # left-aligned with "Rehearsing"

    # "An Interhuman AI Production" above "The"
    sub_x = the_x
    sub_y = top_pad

    # "The" below subtitle
    the_y = sub_y + sub_size + int(sub_size * 0.4)

    # "Rehearsing" below "The"
    main_y = the_y + the_h + int(the_size * 0.1)

    # Subtle shadow only (no panel)
    shadow = max(1, int(main_size * 0.015))

    # Draw shadows — very subtle dark for contrast against sky
    draw.text((sub_x + shadow, sub_y + shadow), sub_text, font=font_sub, fill=(0, 0, 0, 80))
    draw.text((the_x + shadow, the_y + shadow), the_text, font=font_the, fill=(0, 0, 0, 80))
    draw.text((main_x + shadow, main_y + shadow), main_text, font=font_main, fill=(0, 0, 0, 80))

    # Main text — no panel, just clean text
    draw.text((sub_x, sub_y), sub_text, font=font_sub, fill=(255, 255, 255, 240))
    draw.text((the_x, the_y), the_text, font=font_the, fill=TITLE_COLOR_LIGHT)
    draw.text((main_x, main_y), main_text, font=font_main, fill=TITLE_COLOR)

    # Composite and save
    result = Image.alpha_composite(img, overlay).convert("RGB")
    out_path = SCRIPTS_OUT / variant.replace("banner-", "banner-titled-")
    result.save(out_path, "JPEG", quality=92)
    print(f"[text] saved: {out_path}")

print("[text] done.")
