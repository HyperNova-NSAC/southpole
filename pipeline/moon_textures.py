"""Build the landing-page Moon textures from NASA's CGI Moon Kit (SVS 4720).

Inputs (public domain, https://svs.gsfc.nasa.gov/4720):
  lroc_color_poles_4k.tif  LRO WAC colour mosaic, 4096x2048 equirectangular
  ldem_16_uint.tif         LOLA elevation, 16 px/deg, uint16 in half-metres

Outputs, written as TIFF and converted to JPEG by `sips` (see main):
  moon-color-{4k,2k}   colour map
  moon-normal-{4k,2k}  tangent-space normal map derived from the LOLA elevation

Usage: python -m pipeline.moon_textures /path/to/moonkit web/public/moon
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling

MOON_RADIUS_M = 1_737_400.0
HALF_METRE = 0.5
# Relief is exaggerated so craters read at hero scale; the real Moon is very smooth from afar.
RELIEF_EXAGGERATION = 6.0
SIZES = {"4k": (4096, 2048), "2k": (2048, 1024)}


def read_resampled(path: Path, width: int, height: int) -> np.ndarray:
    with rasterio.open(path) as src:
        return src.read(out_shape=(src.count, height, width), resampling=Resampling.average)


def normal_map(heights_m: np.ndarray) -> np.ndarray:
    """Equirectangular heights → RGB tangent-space normals (OpenGL convention, +Y north)."""
    rows, cols = heights_m.shape
    lat = np.deg2rad(90.0 - (np.arange(rows) + 0.5) * 180.0 / rows)
    dy_m = np.pi * MOON_RADIUS_M / rows
    dx_m = 2 * np.pi * MOON_RADIUS_M * np.maximum(np.cos(lat), 0.02) / cols

    east = (np.roll(heights_m, -1, axis=1) - np.roll(heights_m, 1, axis=1)) / (2 * dx_m[:, None])
    padded = np.pad(heights_m, ((1, 1), (0, 0)), mode="edge")
    north = (padded[:-2] - padded[2:]) / (2 * dy_m)

    n = np.stack([-east * RELIEF_EXAGGERATION, -north * RELIEF_EXAGGERATION, np.ones_like(east)])
    n /= np.linalg.norm(n, axis=0, keepdims=True)
    return np.clip((n * 0.5 + 0.5) * 255.0 + 0.5, 0, 255).astype(np.uint8)


def write_rgb_tiff(path: Path, rgb: np.ndarray) -> None:
    _, height, width = rgb.shape
    with rasterio.open(
        path, "w", driver="GTiff", width=width, height=height, count=3, dtype="uint8"
    ) as dst:
        dst.write(rgb)


def to_jpeg(tiff: Path, jpeg: Path, quality: int) -> None:
    subprocess.run(
        ["sips", "-s", "format", "jpeg", "-s", "formatOptions", str(quality), str(tiff), "--out", str(jpeg)],
        check=True,
        capture_output=True,
    )
    tiff.unlink()


def main(kit_dir: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for label, (width, height) in SIZES.items():
        color = read_resampled(kit_dir / "lroc_color_poles_4k.tif", width, height).astype(np.uint8)
        tiff = out_dir / f"moon-color-{label}.tif"
        write_rgb_tiff(tiff, color)
        to_jpeg(tiff, out_dir / f"moon-color-{label}.jpg", 85)

        raw = read_resampled(kit_dir / "ldem_16_uint.tif", width, height)[0].astype(np.float64)
        tiff = out_dir / f"moon-normal-{label}.tif"
        write_rgb_tiff(tiff, normal_map(raw * HALF_METRE))
        to_jpeg(tiff, out_dir / f"moon-normal-{label}.jpg", 90)
        print(f"wrote {label} textures to {out_dir}")


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
