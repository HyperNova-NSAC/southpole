"""Load the south-polar LOLA elevation GeoTIFF into a DemGrid."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DEM_PATH = REPO_ROOT / "dem" / "LDEM_80S_80MPP_ADJ.TIF"
DEFAULT_SOURCE = "Moon Trek LOLA LDEM_80S_80MPP_ADJ, downloaded 2026-11-14"

# Polar stereographic used by the ray marcher (PLAN §7.10).
TARGET_PROJ = "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m"
MOON_RADIUS_M = 1_737_400.0

_TO_STEREO = Transformer.from_crs(
    CRS.from_proj4(f"+proj=latlong +R={MOON_RADIUS_M} +no_defs"),
    CRS.from_proj4(TARGET_PROJ),
    always_xy=True,
)


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

    def sample_xy(self, x_m: float, y_m: float) -> float | None:
        """Bilinear sample at stereographic metres. None if outside the grid."""
        col = (x_m - self.origin_x_m) / self.pixel_m
        row = (self.origin_y_m - y_m) / self.pixel_m
        rows, cols = self.heights_m.shape
        if col < 0.0 or row < 0.0 or col > cols - 1 or row > rows - 1:
            return None

        c0 = int(np.floor(col))
        r0 = int(np.floor(row))
        c1 = min(c0 + 1, cols - 1)
        r1 = min(r0 + 1, rows - 1)
        dc = col - c0
        dr = row - r0

        h00 = float(self.heights_m[r0, c0])
        h01 = float(self.heights_m[r0, c1])
        h10 = float(self.heights_m[r1, c0])
        h11 = float(self.heights_m[r1, c1])
        return (
            h00 * (1.0 - dc) * (1.0 - dr)
            + h01 * dc * (1.0 - dr)
            + h10 * (1.0 - dc) * dr
            + h11 * dc * dr
        )

    def sample(self, p_hat: np.ndarray) -> float | None:
        """Bilinear sample from a Moon-centred unit vector. None if outside."""
        x_m, y_m = unit_to_stereo(p_hat)
        return self.sample_xy(x_m, y_m)

    def height_at(self, lat_deg: float, lon_deg_east: float) -> float | None:
        x_m, y_m = latlon_to_stereo(lat_deg, lon_deg_east)
        return self.sample_xy(x_m, y_m)


def latlon_to_stereo(lat_deg: float, lon_deg_east: float) -> tuple[float, float]:
    x_m, y_m = _TO_STEREO.transform(lon_deg_east, lat_deg)
    return float(x_m), float(y_m)


def unit_to_stereo(p_hat: np.ndarray) -> tuple[float, float]:
    x, y, z = float(p_hat[0]), float(p_hat[1]), float(p_hat[2])
    lat_deg = float(np.degrees(np.arcsin(np.clip(z, -1.0, 1.0))))
    lon_deg = float(np.degrees(np.arctan2(y, x)))
    return latlon_to_stereo(lat_deg, lon_deg)


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
        if abs(abs(ds.transform.e) - pixel_m) > 1e-6:
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


def downsample(grid: DemGrid, target_pixel_m: float = 200.0) -> DemGrid:
    """Block-average to about ``target_pixel_m`` per pixel for the ray marcher."""
    factor = max(1, int(round(target_pixel_m / grid.pixel_m)))
    if factor == 1:
        return grid

    rows, cols = grid.heights_m.shape
    new_rows = rows // factor
    new_cols = cols // factor
    trimmed = grid.heights_m[: new_rows * factor, : new_cols * factor]
    blocked = trimmed.reshape(new_rows, factor, new_cols, factor).mean(axis=(1, 3))

    # New pixel centre is the mean of the averaged block's old centres.
    offset = 0.5 * (factor - 1) * grid.pixel_m
    return DemGrid(
        heights_m=blocked.astype(np.float32, copy=False),
        origin_x_m=grid.origin_x_m + offset,
        origin_y_m=grid.origin_y_m - offset,
        pixel_m=grid.pixel_m * factor,
        source=grid.source,
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
