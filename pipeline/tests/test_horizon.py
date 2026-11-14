"""A1: GeoTIFF loads, flat mask is 360 samples, mask JSON keys match the contract."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.dem_grid import DEFAULT_DEM_PATH, load_dem, summarize
from pipeline.horizon import flat_mask, load_sites, write_flat_masks
from pipeline.models import HorizonMask, Site

REPO_ROOT = Path(__file__).resolve().parents[2]
MASKS_DIR = REPO_ROOT / "web" / "public" / "data" / "masks"


@pytest.fixture
def shackleton() -> Site:
    sites = {s.id: s for s in load_sites()}
    return sites["shackleton-rim"]


def test_load_dem_does_not_throw():
    if not DEFAULT_DEM_PATH.is_file():
        pytest.skip(f"DEM missing at {DEFAULT_DEM_PATH}")
    # Provenance records 189_158_392 bytes. Skip while a download is still running.
    expected_bytes = 189_158_392
    actual_bytes = DEFAULT_DEM_PATH.stat().st_size
    if actual_bytes < expected_bytes:
        pytest.skip(
            f"DEM incomplete: {actual_bytes} / {expected_bytes} bytes at {DEFAULT_DEM_PATH}"
        )
    grid = load_dem()
    info = summarize(grid)
    assert info["width"] == 7600
    assert info["height"] == 7600
    assert info["pixel_m"] == 80.0
    # Pixel centre of [0, 0]: corner (-304000, 304000) plus half a pixel.
    assert info["origin_x_m"] == pytest.approx(-303960.0)
    assert info["origin_y_m"] == pytest.approx(303960.0)
    # Row 0 is the northern edge: origin_y is positive and large.
    assert info["origin_y_m"] > 0
    assert info["min_m"] < info["max_m"]


def test_flat_mask_has_length_360(shackleton: Site):
    mask = flat_mask(shackleton, mast_m=2.0)
    assert len(mask.mask_el_deg) == 360
    assert mask.az_step_deg == 1
    assert mask.terrain_included is False
    assert mask.dem_source == "flat"
    assert all(el == 0.0 for el in mask.mask_el_deg)
    assert mask.mast_m == 2.0
    assert mask.site_id == "shackleton-rim"


def test_mask_json_files_validate():
    for site_id in ("shackleton-rim", "nobile-rim-1"):
        path = MASKS_DIR / f"{site_id}.json"
        assert path.is_file(), f"missing {path}"
        data = json.loads(path.read_text())
        mask = HorizonMask.model_validate(data)
        assert mask.site_id == site_id
        assert len(mask.mask_el_deg) == 360
        assert mask.terrain_included is False
        # Wire format stays camelCase in the file.
        assert "siteId" in data
        assert "maskElDeg" in data
        assert "terrainIncluded" in data


def test_write_flat_masks_round_trip(tmp_path: Path):
    paths = write_flat_masks(
        ["shackleton-rim", "nobile-rim-1"],
        mast_m=2.0,
        out_dir=tmp_path,
    )
    assert len(paths) == 2
    for path in paths:
        HorizonMask.model_validate_json(path.read_text())
