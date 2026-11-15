import { useEffect, useState } from "react";
import type { HorizonMask, Instant, MissionProfile, Site, WindowMetrics } from "../contract/types";
import { EARTH_COMM_MARGIN_DEG, evaluateMission } from "../core/evaluate";
import type { SlipIndex } from "../core/slip";
import { HORIZONS_LOADING, loadMissionData } from "./loadMission";
import { indexFromTables, rememberIndex } from "./missionIndex";
import { siteForScenario, type Scenario } from "./scenarios";

export type LoadedMission = {
  siteId: string;
  samples: Instant[];
  metrics: WindowMetrics;
  mask: HorizonMask;
  terrainNote: string | null;
  index: SlipIndex;
};

export type ScenarioLoad = {
  status: "idle" | "loading" | "ready" | "error";
  message: string | null;
  mission: LoadedMission | null;
};

const IDLE: ScenarioLoad = { status: "idle", message: null, mission: null };

/**
 * Load one landing's ephemeris and terrain. A reload keeps the previous result
 * on screen until the new one arrives. The night limit is not part of this load.
 */
export function useScenarioLoad(
  scenario: Scenario | null,
  sites: Site[],
  profiles: MissionProfile[],
): ScenarioLoad {
  const [load, setLoad] = useState<ScenarioLoad & { key: string }>({ ...IDLE, key: "" });

  const site = scenario && sites.length > 0 ? siteForScenario(scenario, sites) : null;
  const siteKey = site ? `${site.id}:${site.latDeg}:${site.lonDegEast}` : "";
  const landingUtc = scenario?.landingUtc ?? "";
  const durationHours = scenario?.durationHours ?? 0;
  const rulesReady = profiles.length > 0;
  const key = scenario ? `${siteKey}|${landingUtc}|${durationHours}` : "";

  useEffect(() => {
    if (!scenario || !site || !rulesReady) return;
    let cancelled = false;
    setLoad((current) => ({
      key,
      status: "loading",
      message: HORIZONS_LOADING,
      mission: current.key === key ? current.mission : null,
    }));
    void loadMissionData(site, landingUtc, durationHours, fetch, (message) => {
      if (!cancelled) setLoad((current) => ({ ...current, status: "loading", message }));
    }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoad({ key, status: "error", message: result.message, mission: null });
        return;
      }
      const { sun, earth, mask, terrainNote } = result.files;
      const evaluated = evaluateMission(sun, earth, mask, landingUtc, durationHours, EARTH_COMM_MARGIN_DEG);
      const index = indexFromTables(site.id, sun, earth, mask);
      rememberIndex(index);
      setLoad({
        key,
        status: "ready",
        message: null,
        mission: { siteId: site.id, ...evaluated, mask, terrainNote, index },
      });
    });
    return () => {
      cancelled = true;
    };
    // siteKey stands in for the place. The scenario object is a new value whenever
    // another column changes, and reloading on that would cancel a request in flight.
  }, [key, siteKey, landingUtc, durationHours, rulesReady]);

  if (!scenario) return IDLE;
  // A column that moved into this slot must not keep showing the previous landing.
  if (load.key !== key) return { status: "loading", message: HORIZONS_LOADING, mission: null };
  return load;
}
