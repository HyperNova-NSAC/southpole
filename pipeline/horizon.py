"""Horizon masks from the elevation grid."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from pipeline.dem_grid import DemGrid, downsample, load_dem
from pipeline.models import HorizonMask, Site

REPO_ROOT = Path(__file__).resolve().parents[1]
SITES_PATH = REPO_ROOT / "web" / "public" / "data" / "sites.json"
MASKS_DIR = REPO_ROOT / "web" / "public" / "data" / "masks"

DEFAULT_MAST_M = 2.0
FLAT_DEM_SOURCE = "flat"

MOON_RADIUS_M = 1_737_400.0
AZ_STEP_DEG = 1.0
MAX_RANGE_M = 150_000.0
RANGE_GROWTH = 1.02
RANGE_START_M = 20.0


def flat_mask(site: Site, mast_m: float, height_m: float | None = None) -> HorizonMask:
    """Return a 360-sample zero skyline when terrain is missing or out of coverage."""
    return HorizonMask(
        siteId=site.id,
        latDeg=site.lat_deg,
        lonDegEast=site.lon_deg_east,
        mastM=mast_m,
        azStepDeg=1,
        maskElDeg=[0.0] * 360,
        heightM=site.height_m if height_m is None else height_m,
        demSource=FLAT_DEM_SOURCE,
        terrainIncluded=False,
    )


def _local_frame(lat_deg: float, lon_deg: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    phi = np.radians(lat_deg)
    lam = np.radians(lon_deg)
    cos_phi = np.cos(phi)
    sin_phi = np.sin(phi)
    cos_lam = np.cos(lam)
    sin_lam = np.sin(lam)

    u = np.array([cos_phi * cos_lam, cos_phi * sin_lam, sin_phi], dtype=np.float64)
    e = np.array([-sin_lam, cos_lam, 0.0], dtype=np.float64)
    n = np.cross(u, e)
    n /= np.linalg.norm(n)
    return u, e, n


def mask_for(
    grid: DemGrid,
    lat_deg: float,
    lon_deg: float,
    mast_m: float,
    *,
    site_id: str = "custom",
) -> HorizonMask:
    """Ray-march a 360° skyline from the elevation grid (PLAN §7.10)."""
    height_m = grid.height_at(lat_deg, lon_deg)
    if height_m is None:
        site = Site(
            id=site_id,
            name=site_id,
            latDeg=lat_deg,
            lonDegEast=lon_deg,
            heightM=0.0,
            category="polar",
            agency="",
            notes="",
            sourceUrl="",
        )
        return flat_mask(site, mast_m, height_m=0.0)

    u, e, n = _local_frame(lat_deg, lon_deg)
    r_site = (MOON_RADIUS_M + height_m + mast_m) * u
    # Walk on the mean sphere from the surface point under the site.
    surface_hat = u

    mask_el = np.full(360, -90.0, dtype=np.float64)
    hits = 0

    for az in range(360):
        az_rad = np.radians(az * AZ_STEP_DEG)
        dir_h = np.sin(az_rad) * e + np.cos(az_rad) * n
        dir_h /= np.linalg.norm(dir_h)

        max_el = -90.0
        ray_hit = False
        d = RANGE_START_M
        while d <= MAX_RANGE_M:
            # Destination on the sphere at ground range d (PLAN §7.10).
            p_hat = np.cos(d / MOON_RADIUS_M) * surface_hat + np.sin(d / MOON_RADIUS_M) * dir_h
            p_hat /= np.linalg.norm(p_hat)

            h = grid.sample(p_hat)
            if h is None:
                d *= RANGE_GROWTH
                continue

            ray_hit = True
            p = (MOON_RADIUS_M + h) * p_hat
            delta = p - r_site
            norm = np.linalg.norm(delta)
            if norm <= 0.0:
                d *= RANGE_GROWTH
                continue
            el = float(np.degrees(np.arcsin(np.clip(np.dot(delta, u) / norm, -1.0, 1.0))))
            if el > max_el:
                max_el = el
            d *= RANGE_GROWTH

        if ray_hit:
            hits += 1
            mask_el[az] = max_el
        else:
            mask_el[az] = 0.0

    if hits * 2 < 360:
        site = Site(
            id=site_id,
            name=site_id,
            latDeg=lat_deg,
            lonDegEast=lon_deg,
            heightM=float(height_m),
            category="polar",
            agency="",
            notes="",
            sourceUrl="",
        )
        return flat_mask(site, mast_m, height_m=float(height_m))

    return HorizonMask(
        siteId=site_id,
        latDeg=lat_deg,
        lonDegEast=lon_deg,
        mastM=mast_m,
        azStepDeg=1,
        maskElDeg=[float(v) for v in mask_el],
        heightM=float(height_m),
        demSource=grid.source,
        terrainIncluded=True,
    )


def load_sites(path: Path | None = None) -> list[Site]:
    data = json.loads((path or SITES_PATH).read_text())
    return [Site.model_validate(row) for row in data["sites"]]


def write_flat_masks(
    site_ids: list[str],
    mast_m: float = DEFAULT_MAST_M,
    out_dir: Path | None = None,
) -> list[Path]:
    """Write flat HorizonMask JSON files for the given catalog ids."""
    sites = {s.id: s for s in load_sites()}
    destination = out_dir or MASKS_DIR
    destination.mkdir(parents=True, exist_ok=True)

    written: list[Path] = []
    for site_id in site_ids:
        site = sites[site_id]
        mask = flat_mask(site, mast_m)
        path = destination / f"{site_id}.json"
        path.write_text(mask.model_dump_json(by_alias=True, indent=2) + "\n")
        written.append(path)
    return written


def write_site_masks(
    site_ids: list[str] | None = None,
    mast_m: float = DEFAULT_MAST_M,
    out_dir: Path | None = None,
    sites_path: Path | None = None,
    update_sites_height: bool = True,
) -> list[HorizonMask]:
    """Compute real masks for catalog sites and optionally write heightM back."""
    path = sites_path or SITES_PATH
    raw = json.loads(path.read_text())
    sites = [Site.model_validate(row) for row in raw["sites"]]
    by_id = {s.id: s for s in sites}
    ids = site_ids or [s.id for s in sites]

    grid = downsample(load_dem(), target_pixel_m=200.0)
    destination = out_dir or MASKS_DIR
    destination.mkdir(parents=True, exist_ok=True)

    masks: list[HorizonMask] = []
    height_updates: dict[str, float] = {}

    for site_id in ids:
        site = by_id[site_id]
        mask = mask_for(
            grid,
            site.lat_deg,
            site.lon_deg_east,
            mast_m,
            site_id=site.id,
        )
        out = destination / f"{site_id}.json"
        out.write_text(mask.model_dump_json(by_alias=True, indent=2) + "\n")
        masks.append(mask)
        if mask.terrain_included:
            height_updates[site_id] = mask.height_m
        print(
            f"{site_id}: terrainIncluded={mask.terrain_included} "
            f"heightM={mask.height_m:.1f} "
            f"el=[{min(mask.mask_el_deg):.2f}, {max(mask.mask_el_deg):.2f}]"
        )

    if update_sites_height and height_updates:
        for row in raw["sites"]:
            if row["id"] in height_updates:
                row["heightM"] = round(height_updates[row["id"]], 1)
        path.write_text(json.dumps(raw, indent=2) + "\n")
        print(f"updated heightM in {path.relative_to(REPO_ROOT)}")

    return masks


def main() -> None:
    write_site_masks(
        ["shackleton-rim", "nobile-rim-1", "shackleton-floor", "apollo-11"]
    )


if __name__ == "__main__":
    main()
