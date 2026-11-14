# syntax=docker/dockerfile:1
#
# API image: FastAPI + the terrain pipeline.
# Build context is the repo root:  docker build -f docker/api.Dockerfile .
#
# The 189 MB elevation file is NOT baked in. Mount it at /app/dem (see compose.yaml).

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# rasterio's compiled extension links against libexpat at runtime; python:3.12-slim
# does not include it. Install the minimal OS libs rasterio needs on aarch64/x86_64.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libexpat1 \
        libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Dependencies first so code edits do not reinstall them. rasterio, pyproj and numpy
# ship manylinux wheels (GDAL and PROJ included), so no compiler or system libs are needed.
COPY requirements.txt .
RUN pip install -r requirements.txt

# Only what the API reads at run time: the two Python packages and the prebuilt data
# (sites.json and the Horizons tables that the neighbourhood endpoint reuses).
COPY pipeline ./pipeline
COPY server ./server
COPY web/public/data ./web/public/data

# Smoke-test every import at build time so a crash at module-level (e.g. pyproj
# CRS construction, rasterio GDAL bindings) causes the BUILD to fail with a clear
# error message rather than a silent container exit at runtime.
RUN python -c "\
import fastapi, uvicorn, httpx, pydantic, numpy, rasterio; \
from pyproj import CRS, Transformer; \
from pipeline.models import HorizonMask, HorizonsTable, Site; \
from pipeline.dem_grid import DemGrid, downsample, latlon_to_stereo; \
from pipeline.horizon import flat_mask, march_skyline; \
from pipeline.neighborhood import neighborhood_cells; \
from server.horizons_proxy import get_horizons; \
print('All imports OK')"

# Run as an unprivileged user. The Horizons proxy caches responses in server/cache,
# which compose mounts as a volume; create it here so the volume inherits this owner.
RUN useradd --system --no-create-home app \
    && mkdir -p /app/server/cache /app/dem \
    && chown -R app /app/server/cache
USER app

EXPOSE 8000

# /api/health answers as soon as the server is up; `demLoaded` shows whether terrain works.
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=8 \
    CMD python -c "import urllib.request as u; u.urlopen('http://127.0.0.1:8000/api/health', timeout=3)"

CMD ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
