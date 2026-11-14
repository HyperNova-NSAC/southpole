"""A4 neighborhood grid: 11×11 points around a landing site."""

from __future__ import annotations

import json
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from pipeline.dem_grid import DemGrid
from pipeline.horizon import DEFAULT_MAST_M, march_skyline, skyline_at
from pipeline.models import HorizonsTable

REPO_ROOT = Path(__file__).resolve().parents[1]
HORIZONS_DIR = REPO_ROOT / "web" / "public" / "data" / "horizons"
SITES_PATH = REPO_ROOT / "web" / "public" / "data" / "sites.json"

MOON_RADIUS_M = 1_737_400.0
GRID_N = 11
GRID_STEP_M = 500.0
COARSE_AZ_STEP = 2.0
COARSE_MAX_RANGE_M = 80_000.0
SUNLIT_THRESHOLD = 0.5


def _offset_latlon(lat_deg: float, lon_deg: float, east_m: float, north_m: float) -> tuple[float, float]:
    """Small planar offset on the sphere near the south pole."""
    phi = math.radians(lat_deg)
    dphi = north_m / MOON_RADIUS_M
    dlam = east_m / (MOON_RADIUS_M * max(math.cos(phi), 1e-6))
    return lat_deg + math.degrees(dphi), lon_deg + math.degrees(dlam)


def _load_parent_sun(lat_deg: float, lon_deg: float) -> HorizonsTable:
    """Reuse the nearest catalog site's sun table (plan: share parent Horizons)."""
    sites = json.loads(SITES_PATH.read_text())["sites"]
    best = None
    best_d = float("inf")
    for site in sites:
        d = (site["latDeg"] - lat_deg) ** 2 + (site["lonDegEast"] - lon_deg) ** 2
        path = HORIZONS_DIR / f"{site['id']}-sun.json"
        if d < best_d and path.is_file():
            best_d = d
            best = path
    if best is None:
        raise FileNotFoundError(
            "No prefetched Horizons sun table found under web/public/data/horizons/"
        )
    return HorizonsTable.model_validate_json(best.read_text())


def _parse_utc(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(timezone.utc)


def _sunlit_fraction(
    sun: HorizonsTable,
    mask_el: list[float],
    az_step_deg: float,
    landing_utc: str,
    duration_hours: float,
) -> float:
    start = _parse_utc(landing_utc)
    end = start + timedelta(hours=duration_hours)
    samples = [
        s
        for s in sun.samples
        if start <= _parse_utc(s.t) <= end
    ]
    if not samples:
        # Fall back to whole table if the window is outside the file.
        samples = sun.samples
    if not samples:
        return 0.0
    lit = 0
    for s in samples:
        sky = skyline_at(mask_el, s.az_deg, az_step_deg)
        # Coarse disc test: centre of the disc above the skyline.
        if s.el_deg - sky > 0:
            lit += 1
    return lit / len(samples)


def _light(sunlit_fraction: float, max_dark_hours: float | None) -> str:
    # Lightweight traffic light for the neighborhood map.
    if sunlit_fraction >= 0.85:
        return "green"
    if sunlit_fraction >= 0.5:
        return "amber"
    return "red"


def neighborhood_cells(
    grid: DemGrid,
    *,
    lat_deg: float,
    lon_deg: float,
    landing_utc: str,
    duration_hours: float,
    profile_id: str,
    mast_m: float = DEFAULT_MAST_M,
) -> list[dict[str, Any]]:
    sun = _load_parent_sun(lat_deg, lon_deg)
    profiles = json.loads((REPO_ROOT / "web" / "public" / "data" / "profiles.json").read_text())
    profile = next((p for p in profiles["profiles"] if p["id"] == profile_id), None)
    max_dark = None if profile is None else profile.get("maxLongestDarkHours")

    half = GRID_N // 2
    cells: list[dict[str, Any]] = []
    for iy in range(GRID_N):
        for ix in range(GRID_N):
            east_m = (ix - half) * GRID_STEP_M
            north_m = (half - iy) * GRID_STEP_M  # row 0 is north
            cell_lat, cell_lon = _offset_latlon(lat_deg, lon_deg, east_m, north_m)
            mask_el, _height, included = march_skyline(
                grid,
                cell_lat,
                cell_lon,
                mast_m,
                az_step_deg=COARSE_AZ_STEP,
                max_range_m=COARSE_MAX_RANGE_M,
            )
            if not included:
                mask_el = [0.0] * len(mask_el)
            frac = _sunlit_fraction(
                sun, mask_el, COARSE_AZ_STEP, landing_utc, duration_hours
            )
            cells.append(
                {
                    "latDeg": cell_lat,
                    "lonDegEast": cell_lon,
                    "sunlitFraction": frac,
                    "light": _light(frac, max_dark),
                }
            )
    return cells
