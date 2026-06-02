"""
Overlay "The Rehearsing" + "An Interhuman AI Production" on the generated poster variants.
Matches the original Rehearsal poster layout:
  - "An Interhuman AI Production" small, upper area (where "HBO ORIGINAL" sits)
  - "The Rehearsing" large bold title, green, in the upper-middle (where "The Rehearsal" sits)
  - Title uses Georgia Bold (closest available serif to the poster's heavy serif)
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

SCRIPTS_OUT = Path(__file__).parent / "out"

# Georgia Bold is the best available heavy serif — close to the poster's look
FONT_TITLE = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
FONT_THE = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
FONT_SUBTITLE = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

# Green matching a dark, slightly muted tone (not neon)
TITLE_COLOR = (0, 90, 50, 255)  # dark forest green
TITLE_COLOR_LIGHT = (20, 140, 80, 255)  # slightly brighter for "The"

variants = ["poster-v1.jpeg", "poster-v2.jpeg"]

for variant in variants:
    src = SCRIPTS_OUT / variant
    if not src.exists():
        print(f"[text] skipping {variant} — not found")
        continue

    img = Image.open(src).convert("RGBA")
    w, h = img.size

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # --- "An Interhuman AI Production" — small, centered, upper area ---
    # In the original: "HBO ORIGINAL" sits at about 22% from top, small white bold caps
    sub_size = int(w * 0.032)
    font_sub = ImageFont.truetype(FONT_SUBTITLE, sub_size)
    sub_text = "AN INTERHUMAN AI PRODUCTION"

    sub_bbox = draw.textbbox((0, 0), sub_text, font=font_sub)
    sub_w = sub_bbox[2] - sub_bbox[0]
    sub_x = (w - sub_w) // 2
    sub_y = int(h * 0.19)

    # White with subtle shadow
    draw.text((sub_x + 1, sub_y + 1), sub_text, font=font_sub, fill=(0, 0, 0, 100))
    draw.text((sub_x, sub_y), sub_text, font=font_sub, fill=(255, 255, 255, 255))

    # --- "The" + "Rehearsing" — large bold green title ---
    # Original poster: "The" is smaller italic/regular, "Rehearsal" is massive bold
    # Both sit around 24-35% from top

    the_size = int(w * 0.07)
    main_size = int(w * 0.145)
    font_the = ImageFont.truetype(FONT_THE, the_size)
    font_main = ImageFont.truetype(FONT_TITLE, main_size)

    the_text = "The"
    main_text = "Rehearsing"

    the_bbox = draw.textbbox((0, 0), the_text, font=font_the)
    the_w = the_bbox[2] - the_bbox[0]
    the_h = the_bbox[3] - the_bbox[1]

    main_bbox = draw.textbbox((0, 0), main_text, font=font_main)
    main_w = main_bbox[2] - main_bbox[0]
    main_h = main_bbox[3] - main_bbox[1]

    # Center both horizontally
    the_x = (w - the_w) // 2
    main_x = (w - main_w) // 2

    # Vertical positioning: "The" starts around 23%, "Rehearsing" just below
    the_y = int(h * 0.225)
    main_y = the_y + the_h + int(the_size * 0.15)

    # Shadow for depth
    shadow = max(2, int(main_size * 0.025))

    # Draw shadows (dark)
    draw.text((the_x + shadow, the_y + shadow), the_text, font=font_the, fill=(0, 0, 0, 130))
    draw.text((main_x + shadow, main_y + shadow), main_text, font=font_main, fill=(0, 0, 0, 130))

    # Draw main text — green
    draw.text((the_x, the_y), the_text, font=font_the, fill=TITLE_COLOR_LIGHT)
    draw.text((main_x, main_y), main_text, font=font_main, fill=TITLE_COLOR)

    # Composite and save
    result = Image.alpha_composite(img, overlay).convert("RGB")
    out_path = SCRIPTS_OUT / variant.replace("poster-", "poster-titled-")
    result.save(out_path, "JPEG", quality=92)
    print(f"[text] saved: {out_path}")

print("[text] done.")
