"""
Final V1 banner: title starts at exactly half the image width.
"""

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

SCRIPTS_OUT = Path(__file__).parent / "out"

FONT_TITLE = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
FONT_THE = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"
FONT_SUBTITLE = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

TITLE_COLOR = (0, 100, 55, 255)
TITLE_COLOR_LIGHT = (20, 140, 80, 255)

src = SCRIPTS_OUT / "banner-v1.jpeg"
img = Image.open(src).convert("RGBA")
w, h = img.size

overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
draw = ImageDraw.Draw(overlay)

main_size = int(h * 0.09 * 1.4)
the_size = int(main_size * 0.5)
sub_size = int(h * 0.032 * 1.4)

font_main = ImageFont.truetype(FONT_TITLE, main_size)
font_the = ImageFont.truetype(FONT_THE, the_size)
font_sub = ImageFont.truetype(FONT_SUBTITLE, sub_size)

the_text = "The"
main_text = "Rehearsing"
sub_text = "AN INTERHUMAN AI PRODUCTION"

# Measure
the_bbox = draw.textbbox((0, 0), the_text, font=font_the)
the_h = the_bbox[3] - the_bbox[1]

# Left edge: halfway between previous position and midpoint
left_x = w // 2 - (w // 2 - w // 2) // 2
# Previous was right-aligned (~75%), then moved to 50%. Now split the difference: ~50% minus half the shift back
left_x = int(w * 0.375)

# Vertical: upper area
top_pad = int(h * 0.08)
sub_y = top_pad
the_y = sub_y + sub_size + int(sub_size * 0.4)
main_y = the_y + the_h + int(the_size * 0.1)

# Subtle shadow
shadow = max(1, int(main_size * 0.015))

draw.text((left_x + shadow, sub_y + shadow), sub_text, font=font_sub, fill=(0, 0, 0, 80))
draw.text((left_x + shadow, the_y + shadow), the_text, font=font_the, fill=(0, 0, 0, 80))
draw.text((left_x + shadow, main_y + shadow), main_text, font=font_main, fill=(0, 0, 0, 80))

draw.text((left_x, sub_y), sub_text, font=font_sub, fill=(255, 255, 255, 240))
draw.text((left_x, the_y), the_text, font=font_the, fill=TITLE_COLOR_LIGHT)
draw.text((left_x, main_y), main_text, font=font_main, fill=TITLE_COLOR)

result = Image.alpha_composite(img, overlay).convert("RGB")
out_path = SCRIPTS_OUT / "banner-titled-v1.jpeg"
result.save(out_path, "JPEG", quality=92)
print(f"[text] saved: {out_path}")
