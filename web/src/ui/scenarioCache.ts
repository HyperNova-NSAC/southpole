import type { HorizonMask, HorizonsTable, Instant, Site, WindowMetrics } from "../contract/types";
import { EARTH_COMM_MARGIN_DEG, evaluateMission } from "../core/evaluate";
import type { SlipIndex } from "../core/slip";
import { indexFromTables, rememberIndex } from "./missionIndex";
import { loadMissionData } from "./loadMission";

export type LoadedMission = {
  siteId: string;
  samples: Instant[];
  metrics: WindowMetrics;
  mask: HorizonMask;
  terrainNote: string | null;
  index: SlipIndex;
};

export type ScenarioLoadResult = { ok: true; mission: LoadedMission } | { ok: false; message: string };

const missions = new Map<string, LoadedMission>();
const inflight = new Map<string, Promise<ScenarioLoadResult>>();
const indexes = new Map<string, SlipIndex>();

/** Place, touchdown, and window. The night limit is applied later and is not part of the load. */
export function scenarioCacheKey(site: Site, landingUtc: string, durationHours: number): string {
  return [site.id, site.latDeg, site.lonDegEast, site.heightM, landingUtc, Math.round(durationHours * 60)].join("|");
}

export function peekScenario(key: string): LoadedMission | undefined {
  return missions.get(key);
}

export function loadScenario(
  site: Site,
  landingUtc: string,
  durationHours: number,
  fetchImpl: typeof fetch = fetch,
  onStatus?: (message: string) => void,
): Promise<ScenarioLoadResult> {
  const key = scenarioCacheKey(site, landingUtc, durationHours);
  const hit = peekScenario(key);
  if (hit) return Promise.resolve({ ok: true, mission: hit });
  const pending = inflight.get(key);
  if (pending) return pending;

  const job = run(site, landingUtc, durationHours, fetchImpl, onStatus)
    .then((result) => {
      if (result.ok) rememberMission(key, result.mission);
      return result;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, job);
  return job;
}

export function clearScenarioCache(): void {
  missions.clear();
  inflight.clear();
  indexes.clear();
}

function rememberMission(key: string, mission: LoadedMission): void {
  missions.set(key, mission);
  while (missions.size > 24) {
    const oldest = missions.keys().next().value;
    if (oldest === undefined) break;
    missions.delete(oldest);
  }
}

async function run(
  site: Site,
  landingUtc: string,
  durationHours: number,
  fetchImpl: typeof fetch,
  onStatus?: (message: string) => void,
): Promise<ScenarioLoadResult> {
  const result = await loadMissionData(site, landingUtc, durationHours, fetchImpl, onStatus);
  if (!result.ok) return result;
  const { sun, earth, mask, terrainNote } = result.files;
  const evaluated = evaluateMission(sun, earth, mask, landingUtc, durationHours, EARTH_COMM_MARGIN_DEG);
  const index = slipIndex(site, sun, earth, mask);
  return {
    ok: true,
    mission: { siteId: site.id, ...evaluated, mask, terrainNote, index },
  };
}

/** The slip index covers the whole ephemeris table, so every window at that place can share it. */
function slipIndex(site: Site, sun: HorizonsTable, earth: HorizonsTable, mask: HorizonMask): SlipIndex {
  const end = (table: HorizonsTable) => table.samples[table.samples.length - 1]?.t ?? "";
  const key = [
    site.id,
    site.latDeg,
    site.lonDegEast,
    sun.samples.length,
    sun.samples[0]?.t ?? "",
    end(sun),
    earth.samples.length,
    earth.samples[0]?.t ?? "",
    end(earth),
    mask.latDeg,
    mask.lonDegEast,
    mask.terrainIncluded ? 1 : 0,
  ].join("|");
  const hit = indexes.get(key);
  if (hit) return hit;
  const index = indexFromTables(site.id, sun, earth, mask);
  indexes.set(key, index);
  rememberIndex(index);
  return index;
}
