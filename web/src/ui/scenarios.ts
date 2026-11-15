import type { Site } from "../contract/types";
import { customSiteFromCoords } from "./matchSite";
import { CUSTOM_SITE_ID } from "./query";

/** One landing: a place, a touchdown time, and the rules used to score it. */
export type Scenario = {
  id: string;
  siteId: string;
  landingUtc: string;
  durationHours: number;
  maxNightHours: number;
  /** Set only for a typed point that is not in the catalog. */
  latDeg?: number;
  lonDegEast?: number;
};

export const MAX_SCENARIOS = 3;

export type ScenarioPatch = {
  siteId?: string;
  landingUtc?: string;
  latDeg?: number;
  lonDegEast?: number;
  durationHours?: number;
  maxNightHours?: number;
};

export function nextScenarioId(existing: Scenario[]): string {
  let n = existing.length + 1;
  let id = `case-${n}`;
  while (existing.some((scenario) => scenario.id === id)) {
    n += 1;
    id = `case-${n}`;
  }
  return id;
}

/** A catalog site that is not already in the comparison, so a new column starts out different. */
export function differentSiteId(catalog: { id: string }[], usedIds: string[]): string {
  const free = catalog.find((site) => !usedIds.includes(site.id));
  return free?.id ?? catalog[0]?.id ?? usedIds[0] ?? "";
}

export function addScenario(scenarios: Scenario[], draft: Omit<Scenario, "id">): Scenario[] {
  if (scenarios.length >= MAX_SCENARIOS) return scenarios;
  return [...scenarios, { ...draft, id: nextScenarioId(scenarios) }];
}

export function removeScenario(scenarios: Scenario[], id: string): Scenario[] {
  if (scenarios.length <= 1) return scenarios;
  return scenarios.filter((scenario) => scenario.id !== id);
}

export function updateScenario(scenarios: Scenario[], id: string, patch: ScenarioPatch): Scenario[] {
  return scenarios.map((scenario) => {
    if (scenario.id !== id) return scenario;
    const next: Scenario = { ...scenario, ...patch };
    if (next.siteId !== CUSTOM_SITE_ID) {
      delete next.latDeg;
      delete next.lonDegEast;
    }
    return next;
  });
}

export function siteForScenario(scenario: Scenario, sites: Site[]): Site | null {
  if (scenario.siteId === CUSTOM_SITE_ID) {
    if (scenario.latDeg === undefined || scenario.lonDegEast === undefined) return null;
    return customSiteFromCoords(scenario.latDeg, scenario.lonDegEast);
  }
  return sites.find((site) => site.id === scenario.siteId) ?? null;
}
