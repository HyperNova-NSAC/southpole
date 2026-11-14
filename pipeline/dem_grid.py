"""Load the south-polar LOLA elevation GeoTIFF into a DemGrid."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DEM_PATH = REPO_ROOT / "dem" / "LDEM_80S_80MPP_ADJ.TIF"
DEFAULT_SOURCE = "Moon Trek LOLA LDEM_80S_80MPP_ADJ, downloaded 2026-11-14"

# Polar stereographic used by the ray marcher (PLAN §7.10).
TARGET_PROJ = "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m"


@dataclass
class DemGrid:
    """South-polar elevation grid in metres.

    Row 0 is the northern edge of the subset, so y decreases as the row
    index increases. ``origin_x_m`` / ``origin_y_m`` are the centre of
    pixel ``[0, 0]`` (column 0, row 0).
    """

    heights_m: np.ndarray  # float32, shape (rows, cols), north-up
    origin_x_m: float
    origin_y_m: float
    pixel_m: float
    source: str


def load_dem(path: Path | str | None = None, source: str = DEFAULT_SOURCE) -> DemGrid:
    """Load a GeoTIFF into a DemGrid. Points are pixel centres."""
    dem_path = Path(path) if path is not None else DEFAULT_DEM_PATH
    if not dem_path.is_file():
        raise FileNotFoundError(
            f"Elevation file not found: {dem_path}. "
            "Fetch it with the curl command in README.md."
        )

    with rasterio.open(dem_path) as ds:
        heights = ds.read(1).astype(np.float32, copy=False)
        # Affine maps pixel corners; centre of pixel (0, 0) is +0.5 in both axes.
        origin_x = float(ds.transform.c + 0.5 * ds.transform.a)
        origin_y = float(ds.transform.f + 0.5 * ds.transform.e)
        pixel_m = float(abs(ds.transform.a))
        if abs(ds.transform.e) != pixel_m and abs(abs(ds.transform.e) - pixel_m) > 1e-6:
            raise ValueError(
                f"Non-square pixels: x={ds.transform.a}, y={ds.transform.e}"
            )

    return DemGrid(
        heights_m=heights,
        origin_x_m=origin_x,
        origin_y_m=origin_y,
        pixel_m=pixel_m,
        source=source,
    )


def summarize(grid: DemGrid) -> dict[str, object]:
    """Return width, height, min, max, and CRS string for smoke checks."""
    return {
        "width": int(grid.heights_m.shape[1]),
        "height": int(grid.heights_m.shape[0]),
        "min_m": float(np.nanmin(grid.heights_m)),
        "max_m": float(np.nanmax(grid.heights_m)),
        "pixel_m": grid.pixel_m,
        "origin_x_m": grid.origin_x_m,
        "origin_y_m": grid.origin_y_m,
        "crs": TARGET_PROJ,
        "source": grid.source,
    }


def main() -> None:
    grid = load_dem()
    info = summarize(grid)
    print(f"width:  {info['width']}")
    print(f"height: {info['height']}")
    print(f"min_m:  {info['min_m']}")
    print(f"max_m:  {info['max_m']}")
    print(f"pixel:  {info['pixel_m']} m")
    print(f"origin: ({info['origin_x_m']}, {info['origin_y_m']}) m")
    print(f"CRS:    {info['crs']}")


if __name__ == "__main__":
    main()
