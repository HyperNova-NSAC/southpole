import { useEffect, useState } from "react";
import type { MissionProfile, Site } from "../contract/types";
import { HORIZONS_LOADING } from "./loadMission";
import { loadScenario, peekScenario, scenarioCacheKey, type LoadedMission } from "./scenarioCache";
import { siteForScenario, type Scenario } from "./scenarios";

export type { LoadedMission };

export type ScenarioLoad = {
  status: "idle" | "loading" | "ready" | "error";
  message: string | null;
  mission: LoadedMission | null;
};

const IDLE: ScenarioLoad = { status: "idle", message: null, mission: null };

/**
 * Load one landing's ephemeris and terrain. A landing already scored this session
 * is returned immediately. The night limit is not part of this load.
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
  const key = site ? scenarioCacheKey(site, landingUtc, durationHours) : "";
  const cached = key ? peekScenario(key) : undefined;

  useEffect(() => {
    if (!scenario || !site || !rulesReady) return;
    const ready = peekScenario(key);
    if (ready) {
      setLoad({ key, status: "ready", message: null, mission: ready });
      return;
    }
    let cancelled = false;
    setLoad((current) => ({
      key,
      status: "loading",
      message: HORIZONS_LOADING,
      mission: current.key === key ? current.mission : null,
    }));
    void loadScenario(site, landingUtc, durationHours, fetch, (message) => {
      if (!cancelled) setLoad((current) => (current.key === key ? { ...current, status: "loading", message } : current));
    }).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoad({ key, status: "error", message: result.message, mission: null });
        return;
      }
      setLoad({ key, status: "ready", message: null, mission: result.mission });
    });
    return () => {
      cancelled = true;
    };
    // siteKey stands in for the place. The scenario object is a new value whenever
    // another column changes, and reloading on that would cancel a request in flight.
  }, [key, siteKey, landingUtc, durationHours, rulesReady]);

  if (!scenario) return IDLE;
  if (cached) return { status: "ready", message: null, mission: cached };
  // A column that moved into this slot must not keep showing the previous landing.
  if (load.key !== key) return { status: "loading", message: HORIZONS_LOADING, mission: null };
  return load;
}
