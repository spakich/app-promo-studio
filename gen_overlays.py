#!/usr/bin/env python3
"""
App Promo Studio — Text Overlay Generator

Generates transparent PNG overlays for each scene's title/subtitle.
Uses PIL (Pillow) since ffmpeg's drawtext filter is not available.
"""
import json
import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# ─── Config ───
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG  = "/System/Library/Fonts/Supplemental/Arial.ttf"

def load_storyboard(path):
    with open(path) as f:
        return json.load(f)

def make_overlay(title, subtitle, width, height, pos_y="center"):
    """Create a transparent RGBA image with title + subtitle text."""
    img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # ─── Title ───
    title_font = ImageFont.truetype(FONT_BOLD, 72)
    sub_font = ImageFont.truetype(FONT_REG, 38)

    # Calculate positions
    bbox = draw.textbbox((0, 0), title, font=title_font)
    title_w = bbox[2] - bbox[0]
    title_h = bbox[3] - bbox[1]
    title_x = (width - title_w) // 2

    if pos_y == "bottom":
        title_y = height - 180
    elif pos_y == "top":
        title_y = 80
    else:  # center
        title_y = (height // 2) - 60

    # Draw shadow + border for title
    shadow_offset = 3
    for dx, dy in [(shadow_offset, shadow_offset), (-shadow_offset, shadow_offset),
                   (shadow_offset, -shadow_offset), (-shadow_offset, -shadow_offset),
                   (0, shadow_offset), (0, -shadow_offset),
                   (shadow_offset, 0), (-shadow_offset, 0)]:
        draw.text((title_x + dx, title_y + dy), title, font=title_font,
                  fill=(0, 0, 0, 180))

    # Draw title
    draw.text((title_x, title_y), title, font=title_font, fill=(255, 255, 255, 255))

    # ─── Subtitle ───
    if subtitle:
        bbox = draw.textbbox((0, 0), subtitle, font=sub_font)
        sub_w = bbox[2] - bbox[0]
        sub_x = (width - sub_w) // 2

        if pos_y == "bottom":
            sub_y = height - 90
        elif pos_y == "top":
            sub_y = 170
        else:
            sub_y = (height // 2) + 20

        for dx, dy in [(2, 2), (-2, 2), (2, -2), (-2, -2), (0, 2), (0, -2), (2, 0), (-2, 0)]:
            draw.text((sub_x + dx, sub_y + dy), subtitle, font=sub_font,
                      fill=(0, 0, 0, 150))

        draw.text((sub_x, sub_y), subtitle, font=sub_font, fill=(255, 255, 255, 230))

    return img

def main():
    storyboard_path = sys.argv[1] if len(sys.argv) > 1 else "storyboard.json"
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "output/.overlays"

    sb = load_storyboard(storyboard_path)
    W = sb["resolution"]["width"]
    H = sb["resolution"]["height"]

    os.makedirs(output_dir, exist_ok=True)

    for i, scene in enumerate(sb["scenes"]):
        if not scene.get("title"):
            continue

        overlay = make_overlay(
            title=scene["title"],
            subtitle=scene.get("subtitle", ""),
            width=W,
            height=H,
            pos_y=scene.get("position", {}).get("y", "center")
        )

        out_path = os.path.join(output_dir, f"overlay_{i:02d}.png")
        overlay.save(out_path)
        print(f"  ✓ Generated overlay for scene {i}: {scene['title']}")

    print(f"\n✅ {len(sb['scenes'])} overlays generated in {output_dir}")

if __name__ == "__main__":
    main()
