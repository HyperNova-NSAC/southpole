"""Horizon tests: DEM load, flat mask, synthetic ridge, real mask files."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from pipeline.dem_grid import (
    DEFAULT_DEM_PATH,
    DemGrid,
    latlon_to_stereo,
    load_dem,
    summarize,
)
from pipeline.horizon import flat_mask, load_sites, mask_for, write_flat_masks
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
    assert info["origin_x_m"] == pytest.approx(-303960.0)
    assert info["origin_y_m"] == pytest.approx(303960.0)
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


def test_write_flat_masks_round_trip(tmp_path: Path):
    paths = write_flat_masks(
        ["shackleton-rim", "nobile-rim-1"],
        mast_m=2.0,
        out_dir=tmp_path,
    )
    assert len(paths) == 2
    for path in paths:
        HorizonMask.model_validate_json(path.read_text())


def test_synthetic_ridge_peaks_east():
    """PLAN §7.11: 2 km ridge 20 km due east peaks near azimuth 90°."""
    lat_deg = -89.5
    lon_deg = 0.0
    sx, sy = latlon_to_stereo(lat_deg, lon_deg)
    pixel = 200.0
    half = 200  # ±40 km
    origin_x = sx - half * pixel
    origin_y = sy + half * pixel
    size = 2 * half + 1
    heights = np.zeros((size, size), dtype=np.float32)

    site_col = half
    ridge_col = site_col + int(20_000 / pixel)
    assert 0 < ridge_col < size - 1
    heights[:, ridge_col] = 2000.0

    grid = DemGrid(
        heights_m=heights,
        origin_x_m=origin_x,
        origin_y_m=origin_y,
        pixel_m=pixel,
        source="synthetic-ridge",
    )
    mask = mask_for(grid, lat_deg, lon_deg, mast_m=2.0, site_id="synthetic")
    assert mask.terrain_included is True
    peak_az = int(np.argmax(mask.mask_el_deg))
    delta = min(abs(peak_az - 90), 360 - abs(peak_az - 90))
    assert delta <= 5, f"peak azimuth {peak_az} not within 5° of 90"
    assert mask.mask_el_deg[90] > mask.mask_el_deg[270]


def test_mask_json_files_validate():
    for site_id in (
        "shackleton-rim",
        "nobile-rim-1",
        "shackleton-floor",
        "apollo-11",
    ):
        path = MASKS_DIR / f"{site_id}.json"
        if not path.is_file():
            pytest.skip(f"mask not generated yet: {path}")
        data = json.loads(path.read_text())
        mask = HorizonMask.model_validate(data)
        assert mask.site_id == site_id
        assert len(mask.mask_el_deg) == 360
        assert "siteId" in data
        assert "maskElDeg" in data
        assert "terrainIncluded" in data


def test_shackleton_mask_not_flat():
    path = MASKS_DIR / "shackleton-rim.json"
    if not path.is_file():
        pytest.skip("shackleton-rim mask not generated yet")
    mask = HorizonMask.model_validate_json(path.read_text())
    if not mask.terrain_included:
        pytest.skip("terrain not included yet (A1 flat mask)")
    spread = max(mask.mask_el_deg) - min(mask.mask_el_deg)
    assert spread > 0.3
