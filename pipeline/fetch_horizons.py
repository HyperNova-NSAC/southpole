"""Fetch JPL Horizons observer tables for a site and write the JSON cache files.

The Sky track owns this script; the parser lives in pipeline.parse_horizons and
the shared shapes live in pipeline.models.
"""

from __future__ import annotations

import argparse
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

from pipeline import parse_horizons
from pipeline.models import HorizonsTable

DATA_DIR = Path(__file__).resolve().parents[1] / "web" / "public" / "data" / "horizons"

# COMMAND codes for the two bodies the demo needs: Sun and Earth.
BODIES = (("sun", "10"), ("earth", "399"))

# Demo cache window used by the batch prefetch.
START = "2027-03-01 T00:00"
STOP = "2027-04-15 T00:00"


def fetch_table(
    command: str,
    site_coord: str,
    start: str,
    stop: str,
    *,
    site_id: str,
    lat_deg: float,
    lon_deg_east: float,
    alt_km: float = 0.0,
) -> HorizonsTable:
    url = parse_horizons.query_url(command, site_coord, start, stop)
    response = httpx.get(url, timeout=60.0)
    response.raise_for_status()
    body = "sun" if command == "10" else "earth"
    return parse_horizons.parse_result_text(
        response.text,
        body=body,
        site_id=site_id,
        lat_deg=lat_deg,
        lon_deg_east=lon_deg_east,
        alt_km=alt_km,
        query_url_value=url,
        queried_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )


def fetch_site(
    site_id: str,
    lat_deg: float,
    lon_deg_east: float,
    start: str,
    stop: str,
    *,
    sleep_s: float = 2.0,
) -> None:
    site_coord = f"{lon_deg_east},{lat_deg},0"
    for body, command in BODIES:
        table = fetch_table(
            command,
            site_coord,
            start,
            stop,
            site_id=site_id,
            lat_deg=lat_deg,
            lon_deg_east=lon_deg_east,
        )
        payload = json.dumps(table.model_dump(by_alias=True, mode="json"), indent=2) + "\n"
        (DATA_DIR / f"{site_id}-{body}.json").write_text(payload, encoding="utf-8")
        time.sleep(sleep_s)


def fetch_all(sleep_s: float = 2.0) -> None:
    sites_path = Path(__file__).resolve().parents[1] / "web" / "public" / "data" / "sites.json"
    sites = json.loads(sites_path.read_text(encoding="utf-8"))
    for site in sites.get("sites", []):
        sun_path = DATA_DIR / f"{site['id']}-sun.json"
        earth_path = DATA_DIR / f"{site['id']}-earth.json"
        if sun_path.exists() and earth_path.exists():
            continue
        fetch_site(site["id"], site["latDeg"], site["lonDegEast"], START, STOP, sleep_s=sleep_s)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", required=True, help="Site id from web/public/data/sites.json")
    parser.add_argument("--start", required=True, help="Start time, e.g. 2027-03-01 T00:00")
    parser.add_argument("--stop", required=True, help="Stop time, e.g. 2027-04-15 T00:00")
    parser.add_argument("--all", action="store_true", help="Fetch every site in sites.json")
    args = parser.parse_args()
    if args.all:
        fetch_all()
        return
    sites_path = Path(__file__).resolve().parents[1] / "web" / "public" / "data" / "sites.json"
    sites = json.loads(sites_path.read_text(encoding="utf-8"))
    site = next((s for s in sites.get("sites", []) if s["id"] == args.site), None)
    if site is None:
        raise SystemExit(f"unknown site: {args.site}")
    fetch_site(site["id"], site["latDeg"], site["lonDegEast"], args.start, args.stop)


if __name__ == "__main__":
    main()
