import { describe, expect, it } from "vitest";
import type { Site } from "../contract/types";
import { customSiteFromCoords, distanceM, matchCatalogSite } from "./matchSite";

const sites: Site[] = [
  {
    id: "shackleton-rim",
    name: "Shackleton rim",
    latDeg: -89.9,
    lonDegEast: 0,
    heightM: 0,
    category: "polar",
    agency: "NASA",
    notes: "",
    sourceUrl: "",
  },
  {
    id: "nobile-rim-1",
    name: "Nobile Rim 1",
    latDeg: -85.44,
    lonDegEast: 37.37,
    heightM: 0,
    category: "artemis",
    agency: "NASA",
    notes: "",
    sourceUrl: "",
  },
];

describe("matchCatalogSite", () => {
  it("matches a point on a known site", () => {
    const hit = matchCatalogSite(sites, -89.9, 0.0);
    expect(hit?.id).toBe("shackleton-rim");
  });

  it("matches a near miss within two kilometres", () => {
    const hit = matchCatalogSite(sites, -89.901, 0.05);
    expect(hit?.id).toBe("shackleton-rim");
  });

  it("returns null far from every catalog site", () => {
    expect(matchCatalogSite(sites, -80, 10)).toBeNull();
  });

  it("builds a custom site from typed coordinates", () => {
    const site = customSiteFromCoords(-88.12, 190);
    expect(site.id).toBe("custom");
    expect(site.lonDegEast).toBeCloseTo(-170, 5);
    expect(site.category).toBe("polar");
  });

  it("measures lunar ground distance in metres", () => {
    expect(distanceM(-89.9, 0, -89.9, 0)).toBe(0);
    expect(distanceM(-85.44, 37.37, -85.44, 37.37)).toBe(0);
  });
});
