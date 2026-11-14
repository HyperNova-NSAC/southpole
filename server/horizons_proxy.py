"""Disk-cached JPL Horizons proxy. One upstream request at a time."""

from __future__ import annotations

import hashlib
import json
import logging
import threading
from pathlib import Path
from typing import Literal

from pipeline.models import HorizonsTable
from pipeline.parse_horizons import fetch

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).resolve().parent / "cache"
_LOCK = threading.Lock()


def _cache_key(
    *,
    site_id: str,
    lat: float,
    lon: float,
    alt_km: float,
    body: str,
    start: str,
    stop: str,
) -> str:
    # PLAN §6.7: round lat/lon to 4 decimals, altKm to 3.
    payload = "|".join(
        [
            site_id,
            f"{lat:.4f}",
            f"{lon:.4f}",
            f"{alt_km:.3f}",
            body,
            start,
            stop,
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def get_horizons(
    *,
    site_id: str,
    lat: float,
    lon: float,
    alt_km: float,
    body: Literal["sun", "earth"],
    start: str,
    stop: str,
) -> HorizonsTable:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    key = _cache_key(
        site_id=site_id,
        lat=lat,
        lon=lon,
        alt_km=alt_km,
        body=body,
        start=start,
        stop=stop,
    )
    path = CACHE_DIR / f"{key}.json"
    if path.is_file():
        logger.info("cache hit %s", key[:12])
        return HorizonsTable.model_validate_json(path.read_text())

    with _LOCK:
        # Re-check inside the lock in case another waiter filled the cache.
        if path.is_file():
            logger.info("cache hit %s", key[:12])
            return HorizonsTable.model_validate_json(path.read_text())

        logger.info("cache miss %s — querying Horizons", key[:12])
        table = fetch(
            body=body,
            site_id=site_id,
            lat_deg=lat,
            lon_deg_east=lon,
            alt_km=alt_km,
            start=start,
            stop=stop,
        )
        path.write_text(table.model_dump_json(by_alias=True, indent=2) + "\n")
        return table
