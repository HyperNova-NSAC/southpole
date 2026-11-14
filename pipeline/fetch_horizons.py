"""Fetch JPL Horizons observer tables for a site and write the JSON cache files.

The Sky track owns this script; the parser lives in pipeline.parse_horizons and
the shared shapes live in pipeline.models.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Literal

from pipeline import parse_horizons
from pipeline.models import HorizonsTable

DATA_DIR = Path(__file__).resolve().parents[1] / "web" / "public" / "data" / "horizons"
SITES_PATH = Path(__file__).resolve().parents[1] / "web" / "public" / "data" / "sites.json"

# Demo / slip window: covers B1 short demo and B3 half-year index.
DEFAULT_START = "2027-01-01"
DEFAULT_STOP = "2027-06-30"


def fetch_table(
    body: Literal["sun", "earth"],
    *,
    site_id: str,
    lat_deg: float,
    lon_deg_east: float,
    alt_km: float,
    start: str,
    stop: str,
) -> HorizonsTable:
    """Live Horizons request via the shared parse_horizons.fetch helper."""
    return parse_horizons.fetch(
        body=body,
        site_id=site_id,
        lat_deg=lat_deg,
        lon_deg_east=lon_deg_east,
        alt_km=alt_km,
        start=start,
        stop=stop,
    )


def fetch_site(
    site_id: str,
    lat_deg: float,
    lon_deg_east: float,
    start: str,
    stop: str,
    *,
    alt_km: float = 0.0,
    sleep_s: float = 2.0,
    skip_existing: bool = True,
) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for body in ("sun", "earth"):
        out = DATA_DIR / f"{site_id}-{body}.json"
        if skip_existing and out.exists():
            print(f"skip {out.name}")
            continue
        print(f"fetch {site_id} {body} {start} → {stop}")
        table = fetch_table(
            body,  # type: ignore[arg-type]
            site_id=site_id,
            lat_deg=lat_deg,
            lon_deg_east=lon_deg_east,
            alt_km=alt_km,
            start=start,
            stop=stop,
        )
        out.write_text(
            json.dumps(table.model_dump(by_alias=True, mode="json"), indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"  wrote {out.name} ({len(table.samples)} samples)")
        time.sleep(sleep_s)


def fetch_all(start: str, stop: str, sleep_s: float = 2.0) -> None:
    sites = json.loads(SITES_PATH.read_text(encoding="utf-8"))
    for site in sites.get("sites", []):
        alt_km = float(site.get("heightM", 0.0)) / 1000.0
        fetch_site(
            site["id"],
            site["latDeg"],
            site["lonDegEast"],
            start,
            stop,
            alt_km=alt_km,
            sleep_s=sleep_s,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", help="Site id from web/public/data/sites.json")
    parser.add_argument("--start", default=DEFAULT_START, help="Start time")
    parser.add_argument("--stop", default=DEFAULT_STOP, help="Stop time")
    parser.add_argument("--all", action="store_true", help="Fetch every site in sites.json")
    parser.add_argument("--sleep", type=float, default=2.0, help="Seconds between calls")
    args = parser.parse_args()

    if args.all:
        fetch_all(args.start, args.stop, sleep_s=args.sleep)
        return
    if not args.site:
        raise SystemExit("pass --site ID or --all")

    sites = json.loads(SITES_PATH.read_text(encoding="utf-8"))
    site = next((s for s in sites.get("sites", []) if s["id"] == args.site), None)
    if site is None:
        raise SystemExit(f"unknown site: {args.site}")
    fetch_site(
        site["id"],
        site["latDeg"],
        site["lonDegEast"],
        args.start,
        args.stop,
        alt_km=float(site.get("heightM", 0.0)) / 1000.0,
        sleep_s=args.sleep,
    )


if __name__ == "__main__":
    main()
