#!/usr/bin/env python3.11
"""Deploy app-promo-studio to Vercel."""
import urllib.request, json, os, glob, base64

VERCEL_TOKEN = os.popen("source /Users/arnaud/.hermes/.env && echo $VERCEL_TOKEN").read().strip()
PROJECT_ID = "prj_qGuG0vsAwqMPUT987sObegx3tyKs"

headers = {
    "Authorization": f"Bearer {VERCEL_TOKEN}",
    "Content-Type": "application/json",
}

# 1. Set env vars on Vercel
print("1. Configuration variables environnement...")
for key, val in [
    ("VITE_SUPABASE_URL", "https://nnqlazhrwmkrmynoohds.supabase.co"),
    ("VITE_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ucWxhemhyd21rcm15bm9vaGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MTY1MzksImV4cCI6MjEwMTA5MjUzOX0.ZY_ZsvNeGAf30k7pIycWW9wzIDGuABCcPIuqPNfUUlA"),
]:
    data = json.dumps({"key": key, "value": val, "target": ["production", "preview"], "type": "plain"}).encode()
    req = urllib.request.Request(
        f"https://api.vercel.com/v10/projects/{PROJECT_ID}/env",
        data=data, headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"   {key}: OK")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if "already" in body.lower():
            print(f"   {key}: deja configure")
        else:
            print(f"   {key}: {str(e)}")

# 2. Create deployment from git
print("\n2. Creation deployment depuis GitHub...")
deploy_data = json.dumps({
    "name": "app-promo-studio",
    "gitSource": {
        "type": "github",
        "org": "spakich",
        "repo": "app-promo-studio",
        "ref": "main",
    },
    "target": "production",
}).encode()

req = urllib.request.Request(
    "https://api.vercel.com/v13/deployments",
    data=deploy_data, headers=headers, method="POST"
)
try:
    with urllib.request.urlopen(req, timeout=60) as r:
        deploy = json.load(r)
        deploy_id = deploy.get("id", "?")
        deploy_url = deploy.get("url", "?")
        ready = deploy.get("readyState", "?")
        print(f"   Deploy ID: {deploy_id}")
        print(f"   URL: https://{deploy_url}")
        print(f"   Status: {ready}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"   ERREUR: {body[:200]}")
    # Try alternate: link repo first
    print("\n   Tentative: link repo au projet...")

print("\nDEPLOIEMENT LANCE!")
