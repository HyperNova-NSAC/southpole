import { beforeEach, describe, expect, it } from "vitest";
import type { Site } from "../contract/types";
import { clearRequestCache } from "./requestCache";
import { clearScenarioCache, loadScenario, peekScenario, scenarioCacheKey } from "./scenarioCache";

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

const landing = "2027-03-03T00:00:00Z";

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

function fetching(bodyFor: (url: string) => Response) {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return bodyFor(url);
  }) as typeof fetch;
  return { calls, fetchImpl };
}

describe("scenario cache", () => {
  beforeEach(() => {
    clearRequestCache();
    clearScenarioCache();
  });

  it("returns a landing that was already scored without fetching again", async () => {
    const { calls, fetchImpl } = fetching((url) => {
      if (url.includes("-sun.json")) return respond(table("sun"));
      if (url.includes("-earth.json")) return respond(table("earth"));
      if (url.includes("/data/masks/")) return respond(mask());
      return respond("no", 404, "text/plain");
    });

    const first = await loadScenario(site, landing, 336, fetchImpl);
    const second = await loadScenario(site, landing, 336, fetchImpl);
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.mission).toBe(first.mission);
    expect(peekScenario(scenarioCacheKey(site, landing, 336))).toBe(first.ok ? first.mission : undefined);
    expect(calls).toHaveLength(3);
  });

  it("shares one load while the first request is still in flight", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      await gate;
      const url = String(input);
      if (url.includes("-sun.json")) return respond(table("sun"));
      if (url.includes("-earth.json")) return respond(table("earth"));
      if (url.includes("/data/masks/")) return respond(mask());
      return respond("no", 404, "text/plain");
    }) as typeof fetch;

    const pending = Promise.all([loadScenario(site, landing, 336, fetchImpl), loadScenario(site, landing, 336, fetchImpl)]);
    release();
    const [first, second] = await pending;
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.mission).toBe(first.mission);
    expect(calls.filter((url) => url.includes("-sun.json"))).toHaveLength(1);
  });

  it("does not keep a failed load", async () => {
    let fail = true;
    const { calls, fetchImpl } = fetching((url) => {
      if (fail) return respond({ error: "down" }, 502);
      if (url.includes("-sun.json")) return respond(table("sun"));
      if (url.includes("-earth.json")) return respond(table("earth"));
      if (url.includes("/data/masks/")) return respond(mask());
      return respond("no", 404, "text/plain");
    });

    const failed = await loadScenario(site, landing, 336, fetchImpl);
    expect(failed.ok).toBe(false);
    fail = false;
    const recovered = await loadScenario(site, landing, 336, fetchImpl);
    expect(recovered.ok).toBe(true);
    expect(calls.length).toBeGreaterThan(3);
  });
});
