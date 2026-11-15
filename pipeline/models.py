"""JSON shapes shared with web/src/contract. Wire format is camelCase."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class _Camel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class Site(_Camel):
    id: str
    name: str
    lat_deg: float = Field(alias="latDeg")
    lon_deg_east: float = Field(alias="lonDegEast")
    height_m: float = Field(alias="heightM")
    category: Literal["apollo", "international", "clps", "artemis", "polar"]
    agency: str
    notes: str
    source_url: str = Field(alias="sourceUrl")


class HorizonsSample(_Camel):
    t: str
    az_deg: float = Field(alias="azDeg")
    el_deg: float = Field(alias="elDeg")
    ang_diam_deg: float = Field(alias="angDiamDeg")
    illum_frac: float | None = Field(alias="illumFrac")


class HorizonsTable(_Camel):
    body: Literal["sun", "earth"]
    site_id: str = Field(alias="siteId")
    lat_deg: float = Field(alias="latDeg")
    lon_deg_east: float = Field(alias="lonDegEast")
    alt_km: float = Field(alias="altKm")
    step_min: Literal[30] = Field(alias="stepMin")
    queried_at: str = Field(alias="queriedAt")
    query_url: str = Field(alias="queryUrl")
    source: Literal["JPL Horizons"]
    samples: list[HorizonsSample]


class HorizonMask(_Camel):
    site_id: str = Field(alias="siteId")
    lat_deg: float = Field(alias="latDeg")
    lon_deg_east: float = Field(alias="lonDegEast")
    mast_m: float = Field(alias="mastM")
    az_step_deg: Literal[1] = Field(alias="azStepDeg")
    mask_el_deg: list[float] = Field(alias="maskElDeg")
    height_m: float = Field(alias="heightM")
    dem_source: str = Field(alias="demSource")
    terrain_included: bool = Field(alias="terrainIncluded")


class MissionProfile(_Camel):
    id: str
    label: str
    duration_hours: float = Field(alias="durationHours")
    earth_required_at_landing: bool = Field(alias="earthRequiredAtLanding")
    max_longest_dark_hours: float | None = Field(alias="maxLongestDarkHours")
    illustrative: bool
