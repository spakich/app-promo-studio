#!/usr/bin/env python3.11
"""Capture mockups as PNG screenshots using Chrome headless."""
import subprocess, os, time

MOCKUPS_DIR = "/Users/arnaud/app-promo-studio/mockups"
OUTPUT_DIR = "/Users/arnaud/app-promo-studio/public/output/nge"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Chrome path
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

mockups = [
    "nge_dashboard",
    "nge_tourets",
    "nge_reception_ia",
    "nge_kanban",
    "nge_chantiers",
]

for name in mockups:
    html_path = f"file://{MOCKUPS_DIR}/{name}.html"
    png_path = f"{OUTPUT_DIR}/{name}.png"
    
    print(f"Capture: {name}...", end=" ", flush=True)
    
    result = subprocess.run([
        CHROME,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--screenshot=" + png_path,
        "--window-size=1920,1080",
        "--force-device-scale-factor=2",
        "--hide-scrollbars",
        "--virtual-time-budget=2000",
        html_path
    ], capture_output=True, timeout=30)
    
    if os.path.exists(png_path):
        size = os.path.getsize(png_path)
        print(f"OK ({size//1024}KB)")
    else:
        print(f"ERREUR: fichier non créé")

print(f"\n{len(mockups)} captures dans {OUTPUT_DIR}")
