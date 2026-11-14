import { describe, expect, it } from "vitest";
import type { Site } from "../contract/types";
import { HORIZONS_FAILURE, TERRAIN_FAILURE, loadMissionData } from "./loadMission";

const site: Site = {
  id: "shackleton-rim",
  name: "Shackleton rim",
  latDeg: -89.9,
  lonDegEast: 0,
  heightM: 0,
  category: "polar",
  agency: "NASA",
  notes: "",
  sourceUrl: "https://example.test",
};

function table(body: "sun" | "earth") {
  return {
    body,
    siteId: site.id,
    latDeg: site.latDeg,
    lonDegEast: site.lonDegEast,
    altKm: 0,
    stepMin: 30,
    queriedAt: "2026-11-14T00:00:00Z",
    queryUrl: "https://ssd.jpl.nasa.gov/api/horizons.api",
    source: "JPL Horizons",
    samples: [
      { t: "2027-03-03T00:00:00Z", azDeg: 10, elDeg: 2, angDiamDeg: 0.5, illumFrac: body === "earth" ? 0.5 : null },
      { t: "2027-03-17T00:00:00Z", azDeg: 20, elDeg: 1, angDiamDeg: 0.5, illumFrac: body === "earth" ? 0.4 : null },
    ],
  };
}

function mask() {
  return {
    siteId: site.id,
    latDeg: site.latDeg,
    lonDegEast: site.lonDegEast,
    mastM: 2,
    azStepDeg: 1,
    maskElDeg: Array.from({ length: 360 }, () => 0),
    heightM: 0,
    demSource: "flat",
    terrainIncluded: false,
  };
}

function respond(body: unknown, status = 200, type = "application/json"): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": type },
  });
}

describe("loadMissionData", () => {
  it("uses the cached files and does not call the API", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("-sun.json")) return respond(table("sun"));
      if (url.includes("-earth.json")) return respond(table("earth"));
      if (url.includes("/data/masks/")) return respond(mask());
      return respond("no", 404, "text/plain");
    }) as typeof fetch;

    const result = await loadMissionData(site, "2027-03-03T00:00:00Z", 336, fetchImpl);
    expect(result.ok).toBe(true);
    expect(calls.some((url) => url.includes("/api/"))).toBe(false);
  });

  it("asks the API when the dev server returns the page instead of JSON", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/data/horizons/")) return respond("<!doctype html>", 200, "text/html");
      if (url.includes("body=sun")) return respond(table("sun"));
      if (url.includes("body=earth")) return respond(table("earth"));
      if (url.includes("/data/masks/")) return respond(mask());
      return respond("no", 404, "text/plain");
    }) as typeof fetch;

    const result = await loadMissionData(site, "2027-03-03T00:00:00Z", 336, fetchImpl);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.files.sun.samples.length).toBe(2);
  });

  it("shows the Horizons failure when the file and the API are both down", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/data/")) return respond("<!doctype html>", 200, "text/html");
      return respond({ error: "horizons" }, 502);
    }) as typeof fetch;

    const result = await loadMissionData(site, "2027-03-03T00:00:00Z", 336, fetchImpl);
    expect(result).toEqual({ ok: false, message: HORIZONS_FAILURE });
  });

  it("keeps a flat horizon when the terrain file and the API are both down", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("-sun.json")) return respond(table("sun"));
      if (url.includes("-earth.json")) return respond(table("earth"));
      if (url.includes("/data/masks/")) return respond("<!doctype html>", 200, "text/html");
      return respond({ error: "terrain" }, 503);
    }) as typeof fetch;

    const result = await loadMissionData(site, "2027-03-03T00:00:00Z", 336, fetchImpl);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.files.terrainNote).toBe(TERRAIN_FAILURE);
      expect(result.files.mask.terrainIncluded).toBe(false);
      expect(result.files.mask.maskElDeg.every((value) => value === 0)).toBe(true);
    }
  });

  it("asks the API when the cached file does not cover the landing", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("-sun.json")) return respond(table("sun"));
      if (url.includes("-earth.json")) return respond(table("earth"));
      if (url.includes("body=sun")) return respond(table("sun"));
      if (url.includes("body=earth")) return respond(table("earth"));
      if (url.includes("/data/masks/")) return respond(mask());
      return respond("no", 404, "text/plain");
    }) as typeof fetch;

    const result = await loadMissionData(site, "2027-08-01T00:00:00Z", 336, fetchImpl);
    expect(result.ok).toBe(true);
    expect(calls.some((url) => url.includes("/api/horizons"))).toBe(true);
  });
});
