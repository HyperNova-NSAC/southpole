"""Parse a JPL Horizons observer table for a site on the Moon.

The column indexes below were locked in Phase 0 from a live response
(latitude −89.5, longitude 0, 2027-03-01 to 2027-03-04, step 30 minutes).
The CSV header is:

    Date__(UT)__HR:MN, , ,Azi_(a-app), Elev_(a-app), Illu%, Ang-diam

Two blank fields sit between the time and the azimuth. Illumination is a
percent. Angular diameter is arcseconds, even with ANG_FORMAT=DEG.
"""

from __future__ import annotations

import urllib.parse
from datetime import datetime, timezone
from typing import Literal

import httpx

from pipeline.models import HorizonsTable

BODY_COMMAND = {
    "sun": "10",
    "earth": "399",
}

COLUMNS = {
    "time": 0,
    "azDeg": 3,
    "elDeg": 4,
    "illumPercent": 5,
    "angDiamArcsec": 6,
}

HORIZONS_API = "https://ssd.jpl.nasa.gov/api/horizons.api"

# Values that returned a table on 2026-11-14. COMMAND is added per body.
QUERY = {
    "format": "json",
    "OBJ_DATA": "NO",
    "MAKE_EPHEM": "YES",
    "EPHEM_TYPE": "OBSERVER",
    "CENTER": "coord@301",
    "COORD_TYPE": "GEODETIC",
    "APPARENT": "AIRLESS",
    "ANG_FORMAT": "DEG",
    "CSV_FORMAT": "YES",
    "QUANTITIES": "4,10,13",
    "STEP_SIZE": "30 m",
}

_MONTHS = {
    "Jan": 1,
    "Feb": 2,
    "Mar": 3,
    "Apr": 4,
    "May": 5,
    "Jun": 6,
    "Jul": 7,
    "Aug": 8,
    "Sep": 9,
    "Oct": 10,
    "Nov": 11,
    "Dec": 12,
}


def query_url(command: str, site_coord: str, start: str, stop: str) -> str:
    params = {
        "COMMAND": command,
        **QUERY,
        "SITE_COORD": site_coord,
        "START_TIME": start,
        "STOP_TIME": stop,
    }
    return HORIZONS_API + "?" + urllib.parse.urlencode(params)


def _to_iso(raw: str) -> str:
    # "2027-Mar-01 00:00"
    date_part, time_part = raw.split()
    year_s, mon_s, day_s = date_part.split("-")
    hour_s, minute_s = time_part.split(":")
    moment = datetime(
        int(year_s),
        _MONTHS[mon_s],
        int(day_s),
        int(hour_s),
        int(minute_s),
        tzinfo=timezone.utc,
    )
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_result_text(
    text: str,
    *,
    body: str,
    site_id: str,
    lat_deg: float,
    lon_deg_east: float,
    alt_km: float,
    query_url_value: str,
    queried_at: str,
) -> HorizonsTable:
    start = text.index("$$SOE")
    end = text.index("$$EOE")
    samples = []
    for line in text[start:end].splitlines():
        line = line.strip()
        if not line or line.startswith("$$") or line.startswith("Date"):
            continue
        fields = [part.strip() for part in line.split(",")]
        if len(fields) <= COLUMNS["angDiamArcsec"]:
            continue
        illum_raw = fields[COLUMNS["illumPercent"]]
        samples.append(
            {
                "t": _to_iso(fields[COLUMNS["time"]]),
                "azDeg": float(fields[COLUMNS["azDeg"]]),
                "elDeg": float(fields[COLUMNS["elDeg"]]),
                "angDiamDeg": float(fields[COLUMNS["angDiamArcsec"]]) / 3600.0,
                "illumFrac": None if illum_raw == "" else float(illum_raw) / 100.0,
            }
        )
    if len(samples) < 2:
        raise ValueError("Horizons table did not contain two samples")
    for sample in samples:
        az = sample["azDeg"] % 360.0
        if az < 0:
            az += 360.0
        sample["azDeg"] = az
    return HorizonsTable.model_validate(
        {
            "body": body,
            "siteId": site_id,
            "latDeg": lat_deg,
            "lonDegEast": lon_deg_east,
            "altKm": alt_km,
            "stepMin": 30,
            "queriedAt": queried_at,
            "queryUrl": query_url_value,
            "source": "JPL Horizons",
            "samples": samples,
        }
    )


def fetch(
    *,
    body: Literal["sun", "earth"],
    site_id: str,
    lat_deg: float,
    lon_deg_east: float,
    alt_km: float,
    start: str,
    stop: str,
    timeout_s: float = 60.0,
) -> HorizonsTable:
    """Query JPL Horizons and return a parsed HorizonsTable.

    Terrain's API proxy calls this. Sky owns the richer CLI in fetch_horizons.py;
    this is the shared live request used until that lands on main.
    """
    command = BODY_COMMAND[body]
    # DESIGN.md: SITE_COORD is lon,lat,alt_km (east-positive longitude).
    site_coord = f"{lon_deg_east},{lat_deg},{alt_km}"
    url = query_url(command, site_coord, start, stop)
    with httpx.Client(timeout=timeout_s) as client:
        response = client.get(url)
        response.raise_for_status()
        payload = response.json()
    result = payload.get("result")
    if not isinstance(result, str) or "$$SOE" not in result:
        raise ValueError("Horizons response did not contain an observer table")
    queried_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return parse_result_text(
        result,
        body=body,
        site_id=site_id,
        lat_deg=lat_deg,
        lon_deg_east=lon_deg_east,
        alt_km=alt_km,
        query_url_value=url,
        queried_at=queried_at,
    )
