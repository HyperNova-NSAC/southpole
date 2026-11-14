import type { Site } from "../contract/types";

const MOON_RADIUS_M = 1_737_400;
/** Treat a typed point as a catalog site when it is within this distance. */
export const SITE_MATCH_M = 2_000;

function wrapLon(lonDegEast: number): number {
  let lon = lonDegEast;
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}

/** Ground distance in metres between two lunar lat/lon points. */
export function distanceM(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
): number {
  const phi1 = (latA * Math.PI) / 180;
  const phi2 = (latB * Math.PI) / 180;
  const dPhi = phi2 - phi1;
  const dLam = ((wrapLon(lonB) - wrapLon(lonA)) * Math.PI) / 180;
  const x = dLam * Math.cos((phi1 + phi2) / 2);
  const y = dPhi;
  return Math.hypot(x, y) * MOON_RADIUS_M;
}

/** Closest catalog site within SITE_MATCH_M, or null. */
export function matchCatalogSite(
  sites: Site[],
  latDeg: number,
  lonDegEast: number,
  maxM: number = SITE_MATCH_M,
): Site | null {
  let best: Site | null = null;
  let bestD = Infinity;
  for (const site of sites) {
    if (site.id === "custom") continue;
    const d = distanceM(site.latDeg, site.lonDegEast, latDeg, lonDegEast);
    if (d < bestD) {
      bestD = d;
      best = site;
    }
  }
  if (!best || bestD > maxM) return null;
  return best;
}

export function customSiteFromCoords(latDeg: number, lonDegEast: number): Site {
  const lat = Number(latDeg.toFixed(5));
  const lon = Number(wrapLon(lonDegEast).toFixed(5));
  return {
    id: "custom",
    name: `Custom ${lat.toFixed(2)}°, ${lon.toFixed(2)}° E`,
    latDeg: lat,
    lonDegEast: lon,
    heightM: 0,
    category: lat <= -60 ? "polar" : "apollo",
    agency: "Typed",
    notes: "Typed for this session. It is not saved in the catalog.",
    sourceUrl: "",
  };
}
