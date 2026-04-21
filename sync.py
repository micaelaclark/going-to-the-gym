#!/usr/bin/env python3
"""
Sync runs from Strava and Oura into data/workouts.json.

SETUP
-----
1. Copy .env.example to .env and fill in your credentials (see below).
2. pip install requests python-dotenv
3. python sync.py

GETTING STRAVA CREDENTIALS
---------------------------
a. Create a free app at https://www.strava.com/settings/api
   Set "Authorization Callback Domain" to localhost.
b. Copy your Client ID and Client Secret into .env.
c. Run once with --setup-strava to get your refresh token:
     python sync.py --setup-strava
   Follow the prompt, paste the redirect URL, and the token is saved to .env.

GETTING OURA TOKEN
------------------
a. Go to https://cloud.ouraring.com/personal-access-tokens
b. Create a Personal Access Token and paste it into .env.
"""

import json
import os
import sys
import webbrowser
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urlparse, parse_qs

import requests
from dotenv import load_dotenv, set_key

# ── Paths ──────────────────────────────────────────────────────────────────

ROOT = Path(__file__).parent
DATA_FILE = ROOT / "data" / "workouts.json"
ENV_FILE = ROOT / ".env"

load_dotenv(ENV_FILE)

# ── Credentials ────────────────────────────────────────────────────────────

STRAVA_CLIENT_ID     = os.environ.get("STRAVA_CLIENT_ID", "")
STRAVA_CLIENT_SECRET = os.environ.get("STRAVA_CLIENT_SECRET", "")
STRAVA_REFRESH_TOKEN = os.environ.get("STRAVA_REFRESH_TOKEN", "")
OURA_TOKEN           = os.environ.get("OURA_PERSONAL_TOKEN", "")

# ── Strava ─────────────────────────────────────────────────────────────────

def strava_setup():
    """One-time flow to get a Strava refresh token and save it to .env."""
    if not STRAVA_CLIENT_ID or not STRAVA_CLIENT_SECRET:
        print("Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in .env first.")
        sys.exit(1)

    params = urlencode({
        "client_id": STRAVA_CLIENT_ID,
        "redirect_uri": "http://localhost",
        "response_type": "code",
        "scope": "activity:read_all",
    })
    url = f"https://www.strava.com/oauth/authorize?{params}"
    print(f"\nOpening Strava authorization page...\n{url}\n")
    webbrowser.open(url)

    redirect = input("Paste the full redirect URL here: ").strip()
    code = parse_qs(urlparse(redirect).query).get("code", [None])[0]
    if not code:
        print("Could not parse code from URL.")
        sys.exit(1)

    resp = requests.post("https://www.strava.com/oauth/token", data={
        "client_id": STRAVA_CLIENT_ID,
        "client_secret": STRAVA_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
    })
    resp.raise_for_status()
    refresh_token = resp.json()["refresh_token"]
    set_key(str(ENV_FILE), "STRAVA_REFRESH_TOKEN", refresh_token)
    print(f"\nRefresh token saved to .env. You can now run: python sync.py")


def strava_access_token():
    resp = requests.post("https://www.strava.com/oauth/token", data={
        "client_id": STRAVA_CLIENT_ID,
        "client_secret": STRAVA_CLIENT_SECRET,
        "refresh_token": STRAVA_REFRESH_TOKEN,
        "grant_type": "refresh_token",
    })
    resp.raise_for_status()
    return resp.json()["access_token"]


def fetch_strava_runs():
    token = strava_access_token()
    runs, page = [], 1
    while True:
        resp = requests.get(
            "https://www.strava.com/api/v3/athlete/activities",
            headers={"Authorization": f"Bearer {token}"},
            params={"per_page": 100, "page": page},
        )
        resp.raise_for_status()
        activities = resp.json()
        if not activities:
            break
        for a in activities:
            if a["type"] == "Run":
                runs.append({
                    "date": a["start_date_local"][:10],
                    "distance": round(a["distance"] / 1609.34, 2),
                    "speed": round(a["average_speed"] * 2.23694, 2),
                })
        page += 1
    return runs

# ── Oura ───────────────────────────────────────────────────────────────────

OURA_CARDIO = {"running", "walking", "cycling", "swimming", "rowing"}

def fetch_oura_runs():
    resp = requests.get(
        "https://api.ouraring.com/v2/usercollection/workout",
        headers={"Authorization": f"Bearer {OURA_TOKEN}"},
        params={"limit": 50},
    )
    resp.raise_for_status()

    runs = []
    for w in resp.json().get("data", []):
        if w.get("activity", "").lower() not in OURA_CARDIO:
            continue
        distance_m = w.get("distance") or 0
        if not distance_m:
            continue
        distance_miles = round(distance_m / 1609.34, 2)
        start = datetime.fromisoformat(w["start_datetime"].replace("Z", "+00:00"))
        end   = datetime.fromisoformat(w["end_datetime"].replace("Z", "+00:00"))
        duration_h = (end - start).total_seconds() / 3600
        speed = round(distance_miles / duration_h, 2) if duration_h else 0
        runs.append({"date": w["day"], "distance": distance_miles, "speed": speed})
    return runs

# ── Merge ──────────────────────────────────────────────────────────────────

def merge_runs(existing, new_runs):
    seen = {r["date"] for r in existing}
    added = 0
    for run in new_runs:
        if run["date"] not in seen:
            existing.append(run)
            seen.add(run["date"])
            added += 1
    return added

# ── Main ───────────────────────────────────────────────────────────────────

def main():
    with open(DATA_FILE) as f:
        data = json.load(f)

    total = 0

    if STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET and STRAVA_REFRESH_TOKEN:
        print("Fetching Strava runs...")
        added = merge_runs(data["running"], fetch_strava_runs())
        print(f"  +{added} run(s) from Strava")
        total += added
    else:
        print("Skipping Strava (credentials not set in .env)")

    if OURA_TOKEN:
        print("Fetching Oura workouts...")
        added = merge_runs(data["running"], fetch_oura_runs())
        print(f"  +{added} run(s) from Oura")
        total += added
    else:
        print("Skipping Oura (OURA_PERSONAL_TOKEN not set in .env)")

    if total:
        data["running"].sort(key=lambda r: r["date"])
        with open(DATA_FILE, "w") as f:
            json.dump(data, f, indent=2)
        print(f"\nSaved {total} new entry/entries to workouts.json.")
        print("Next: git add data/workouts.json && git commit -m 'sync: update runs' && git push")
    else:
        print("\nNo new entries — workouts.json unchanged.")


if __name__ == "__main__":
    if "--setup-strava" in sys.argv:
        strava_setup()
    else:
        main()
