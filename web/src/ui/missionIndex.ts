import type { HorizonMask, HorizonsTable, Instant, MissionProfile, Site } from "../contract/types";
import { EARTH_COMM_MARGIN_DEG, evaluateInstant } from "../core/evaluate";
import { buildSlipIndex, nextDates, type SlipIndex } from "../core/slip";
import { loadMissionData } from "./loadMission";

const DAY_MS = 24 * 60 * 60 * 1000;
const indexCache = new Map<string, Promise<SlipIndex | null>>();

export function indexFromTables(
  siteId: string,
  sun: HorizonsTable,
  earth: HorizonsTable,
  mask: HorizonMask,
): SlipIndex {
  const count = Math.min(sun.samples.length, earth.samples.length);
  const samples: Instant[] = [];
  for (let i = 0; i < count; i += 1) {
    samples.push(evaluateInstant(sun.samples[i], earth.samples[i], mask, EARTH_COMM_MARGIN_DEG));
  }
  return buildSlipIndex(siteId, samples[0]?.t ?? "2027-01-01T00:00:00Z", sun.stepMin, samples);
}

export function rememberIndex(index: SlipIndex): void {
  indexCache.set(index.siteId, Promise.resolve(index));
}

export function cachedIndex(site: Site): Promise<SlipIndex | null> {
  const hit = indexCache.get(site.id);
  if (hit) return hit;
  const pending = loadMissionData(site, "2027-03-03T00:00:00Z", 336).then((result) => {
    if (!result.ok) return null;
    return indexFromTables(site.id, result.files.sun, result.files.earth, result.files.mask);
  });
  indexCache.set(site.id, pending);
  return pending;
}

/** Working landings from nextDates, kept at least a day apart so the three choices are distinct. */
export function suggestDates(index: SlipIndex, profile: MissionProfile, count = 3): string[] {
  const candidates = nextDates(index, profile, index.sunlit.length);
  const picked: string[] = [];
  for (const iso of candidates) {
    const ms = Date.parse(iso);
    if (picked.some((prev) => Math.abs(Date.parse(prev) - ms) < DAY_MS)) continue;
    picked.push(iso);
    if (picked.length >= count) break;
  }
  return picked;
}
