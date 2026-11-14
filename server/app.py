"""Lunar Skyline API: health, Horizons proxy, and on-demand horizon masks."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from pipeline.dem_grid import DemGrid, downsample, load_dem
from pipeline.horizon import mask_for
from server.horizons_proxy import get_horizons

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

_grid: DemGrid | None = None


class HorizonRequest(BaseModel):
    site_id: str = Field(default="custom", alias="siteId")
    lat_deg: float = Field(alias="latDeg")
    lon_deg_east: float = Field(alias="lonDegEast")
    mast_m: float = Field(default=2.0, alias="mastM")

    model_config = {"populate_by_name": True}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _grid
    try:
        logger.info("Loading elevation grid…")
        _grid = downsample(load_dem(), target_pixel_m=200.0)
        logger.info(
            "DEM ready: %sx%s @ %.0f m",
            _grid.heights_m.shape[1],
            _grid.heights_m.shape[0],
            _grid.pixel_m,
        )
    except Exception:
        logger.exception("Failed to load DEM; POST /api/horizon will return 503")
        _grid = None
    yield


app = FastAPI(title="Lunar Skyline", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "demLoaded": _grid is not None}


@app.get("/api/horizons", response_model=None)
def horizons(
    siteId: str = Query(...),
    lat: float = Query(...),
    lon: float = Query(...),
    altKm: float = Query(0.0),
    body: Literal["sun", "earth"] = Query(...),
    start: str = Query(...),
    stop: str = Query(...),
):
    try:
        table = get_horizons(
            site_id=siteId,
            lat=lat,
            lon=lon,
            alt_km=altKm,
            body=body,
            start=start,
            stop=stop,
        )
        return JSONResponse(content=table.model_dump(by_alias=True))
    except Exception as exc:
        logger.exception("Horizons proxy failed")
        return JSONResponse(
            status_code=502,
            content={"error": "horizons", "message": str(exc)},
        )


@app.post("/api/horizon", response_model=None)
def horizon(req: HorizonRequest):
    if _grid is None:
        return JSONResponse(
            status_code=503,
            content={
                "error": "terrain",
                "message": "Elevation grid is not loaded on this server.",
            },
        )
    try:
        mask = mask_for(
            _grid,
            req.lat_deg,
            req.lon_deg_east,
            req.mast_m,
            site_id=req.site_id,
        )
        return JSONResponse(content=mask.model_dump(by_alias=True))
    except Exception as exc:
        logger.exception("Horizon march failed")
        return JSONResponse(
            status_code=503,
            content={"error": "terrain", "message": str(exc)},
        )
