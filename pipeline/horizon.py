"""Horizon masks from the elevation grid. A1 ships a flat fallback only."""

from __future__ import annotations

import json
from pathlib import Path

from pipeline.models import HorizonMask, Site

REPO_ROOT = Path(__file__).resolve().parents[1]
SITES_PATH = REPO_ROOT / "web" / "public" / "data" / "sites.json"
MASKS_DIR = REPO_ROOT / "web" / "public" / "data" / "masks"

DEFAULT_MAST_M = 2.0
FLAT_DEM_SOURCE = "flat"


def flat_mask(site: Site, mast_m: float) -> HorizonMask:
    """Return a 360-sample zero skyline. Used until the ray marcher lands in A2."""
    return HorizonMask(
        siteId=site.id,
        latDeg=site.lat_deg,
        lonDegEast=site.lon_deg_east,
        mastM=mast_m,
        azStepDeg=1,
        maskElDeg=[0.0] * 360,
        heightM=site.height_m,
        demSource=FLAT_DEM_SOURCE,
        terrainIncluded=False,
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


def main() -> None:
    paths = write_flat_masks(["shackleton-rim", "nobile-rim-1"])
    for path in paths:
        print(f"wrote {path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
