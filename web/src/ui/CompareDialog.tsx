import { useState } from "react";
import type { MissionProfile, Site } from "../contract/types";
import { EARTH_COMM_MARGIN_DEG } from "../core/evaluate";
import { buildVerdict } from "../core/verdict";
import { compare } from "../core/compare";
import { matchCatalogSite } from "./matchSite";
import {
  CUSTOM_SITE_ID,
  durationHoursFromAmount,
  formatWindowAmount,
  windowFieldLimits,
  windowUnit,
  type WindowUnit,
} from "./query";
import { countdownValue, formatDuration, percent, summarize } from "./result";
import { differentSiteId, nextScenarioId, siteForScenario, type Scenario } from "./scenarios";
import { useScenarioLoad } from "./useScenarioLoad";

type Draft = {
  id: string;
  siteId: string;
  lat: string;
  lon: string;
  when: string;
  windowAmount: string;
  windowUnit: WindowUnit;
  nightAmount: string;
  nightUnit: WindowUnit;
};

type CompareDialogProps = {
  sites: Site[];
  profiles: MissionProfile[];
  current: Scenario;
  onClose: () => void;
  /** Put this landing on the main page, with its sky and timeline. */
  onUse: (scenario: Scenario) => void;
};

const whenFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function toInputValue(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "" : new Date(ms).toISOString().slice(0, 16);
}

function fromInputValue(value: string): string | null {
  const ms = Date.parse(`${value}:00Z`);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function parseCoord(text: string, limit: number): number | null {
  const value = Number.parseFloat(text);
  return Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
}

function placeName(scenario: Scenario, sites: Site[]): string {
  if (scenario.siteId === CUSTOM_SITE_ID) {
    const lat = scenario.latDeg?.toFixed(2) ?? "";
    const lon = scenario.lonDegEast?.toFixed(2) ?? "";
    return `Custom ${lat}°, ${lon}°`;
  }
  return sites.find((site) => site.id === scenario.siteId)?.name ?? "Landing";
}

function draftFromScenario(scenario: Scenario, id: string, siteId: string, sites: Site[]): Draft {
  const site = sites.find((item) => item.id === siteId);
  const hoursUnit = windowUnit(scenario.durationHours);
  const nightUnit = windowUnit(scenario.maxNightHours);
  return {
    id,
    siteId,
    lat: site ? site.latDeg.toFixed(4) : "",
    lon: site ? site.lonDegEast.toFixed(4) : "",
    when: toInputValue(scenario.landingUtc),
    windowAmount: formatWindowAmount(scenario.durationHours, hoursUnit),
    windowUnit: hoursUnit,
    nightAmount: formatWindowAmount(scenario.maxNightHours, nightUnit),
    nightUnit,
  };
}

function snapDraftCoords(draft: Draft, sites: Site[], onChange: (patch: Partial<Draft>) => void) {
  const scenario = draftToScenario(draft, sites);
  const place = scenario ? siteForScenario(scenario, sites) : null;
  if (!scenario || !place) return;
  onChange({ siteId: scenario.siteId, lat: place.latDeg.toFixed(4), lon: place.lonDegEast.toFixed(4) });
}

function draftToScenario(draft: Draft, sites: Site[]): Scenario | null {
  const lat = parseCoord(draft.lat, 90);
  const lon = parseCoord(draft.lon, 360);
  const landingUtc = fromInputValue(draft.when);
  const windowAmount = Number.parseFloat(draft.windowAmount);
  const nightAmount = Number.parseFloat(draft.nightAmount);
  if (lat === null || lon === null || !landingUtc) return null;
  if (!Number.isFinite(windowAmount) || !Number.isFinite(nightAmount)) return null;
  const known = matchCatalogSite(sites, lat, lon);
  return {
    id: draft.id,
    siteId: known?.id ?? CUSTOM_SITE_ID,
    landingUtc,
    durationHours: durationHoursFromAmount(windowAmount, draft.windowUnit),
    maxNightHours: durationHoursFromAmount(nightAmount, draft.nightUnit),
    ...(known ? {} : { latDeg: lat, lonDegEast: lon }),
  };
}

export function CompareDialog({ sites, profiles, current, onClose, onUse }: CompareDialogProps) {
  const [drafts, setDrafts] = useState<Draft[]>(() => [
    draftFromScenario(current, "alt-1", differentSiteId(sites, [current.siteId]), sites),
  ]);
  const [compared, setCompared] = useState<Scenario[] | null>(null);

  const readyDrafts = drafts.map((draft) => draftToScenario(draft, sites));
  const canCompare = readyDrafts.every((scenario) => scenario !== null);

  const column0 = compared?.[0] ?? null;
  const column1 = compared?.[1] ?? null;
  const column2 = compared?.[2] ?? null;
  const load0 = useScenarioLoad(column0, sites, profiles);
  const load1 = useScenarioLoad(column1, sites, profiles);
  const load2 = useScenarioLoad(column2, sites, profiles);
  const loads = [load0, load1, load2];

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((list) => list.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
    setCompared(null);
  }

  function chooseSite(id: string, siteId: string) {
    const site = sites.find((item) => item.id === siteId);
    updateDraft(id, site ? { siteId, lat: site.latDeg.toFixed(4), lon: site.lonDegEast.toFixed(4) } : { siteId });
  }

  function addDraft() {
    if (drafts.length >= 2) return;
    const used = [current.siteId, ...drafts.map((draft) => draft.siteId)];
    setDrafts((list) => [
      ...list,
      draftFromScenario(current, nextScenarioId(list.map((draft) => ({ ...current, id: draft.id }))), differentSiteId(sites, used), sites),
    ]);
    setCompared(null);
  }

  function compareNow() {
    const extras = readyDrafts.filter((scenario): scenario is Scenario => scenario !== null);
    if (extras.length !== drafts.length) return;
    setCompared([current, ...extras]);
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog compare-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="compare-title">{compared ? "Comparison" : "Compare against"}</h2>
        {compared ? (
          <Results
            scenarios={compared}
            loads={loads}
            sites={sites}
            profiles={profiles}
            onUse={onUse}
            onEdit={() => setCompared(null)}
          />
        ) : (
          <>
            <p className="card-subtitle">
              The landing on the page stays the current one. Each added scenario has its own place, time, window, and night limit.
            </p>
            <div className="compare-setup">
              <CurrentCard scenario={current} sites={sites} />
              {drafts.map((draft, index) => (
                <ScenarioForm
                  key={draft.id}
                  draft={draft}
                  index={index + 2}
                  sites={sites}
                  canRemove={drafts.length > 1}
                  onChange={(patch) => updateDraft(draft.id, patch)}
                  onSite={(siteId) => chooseSite(draft.id, siteId)}
                  onRemove={() => {
                    setDrafts((list) => list.filter((item) => item.id !== draft.id));
                    setCompared(null);
                  }}
                />
              ))}
            </div>
            <div className="compare-actions">
              {drafts.length < 2 ? (
                <button type="button" className="compare-open" onClick={addDraft}>
                  Add another scenario
                </button>
              ) : null}
              <button type="button" className="dialog-close" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="dialog-close" disabled={!canCompare} onClick={compareNow}>
                Compare
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CurrentCard({ scenario, sites }: { scenario: Scenario; sites: Site[] }) {
  const when = Date.parse(scenario.landingUtc);
  return (
    <section className="compare-card current">
      <p className="compare-kicker">Current</p>
      <h3>{placeName(scenario, sites)}</h3>
      <dl className="compare-facts">
        <div>
          <dt>Latitude</dt>
          <dd>{siteForScenario(scenario, sites)?.latDeg.toFixed(4) ?? "—"}°</dd>
        </div>
        <div>
          <dt>Longitude</dt>
          <dd>{siteForScenario(scenario, sites)?.lonDegEast.toFixed(4) ?? "—"}°</dd>
        </div>
        <div>
          <dt>Window</dt>
          <dd>{formatDuration(scenario.durationHours)}</dd>
        </div>
        <div>
          <dt>Night limit</dt>
          <dd>{formatDuration(scenario.maxNightHours)}</dd>
        </div>
        <div>
          <dt>Touchdown</dt>
          <dd>{Number.isNaN(when) ? "—" : `${whenFormat.format(new Date(when))} UTC`}</dd>
        </div>
      </dl>
    </section>
  );
}

function ScenarioForm({
  draft,
  index,
  sites,
  canRemove,
  onChange,
  onSite,
  onRemove,
}: {
  draft: Draft;
  index: number;
  sites: Site[];
  canRemove: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onSite: (siteId: string) => void;
  onRemove: () => void;
}) {
  const windowLimits = windowFieldLimits(draft.windowUnit);
  const nightLimits = windowFieldLimits(draft.nightUnit);
  return (
    <section className="compare-card">
      <div className="compare-card-top">
        <p className="compare-kicker">Scenario {index}</p>
        {canRemove ? (
          <button type="button" className="compare-remove" onClick={onRemove}>
            Remove
          </button>
        ) : null}
      </div>
      <label className="field">
        <span>Known site</span>
        <select value={draft.siteId === CUSTOM_SITE_ID ? "" : draft.siteId} onChange={(event) => onSite(event.target.value)}>
          <option value="">Custom point</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </label>
      <div className="compare-pair">
        <label className="field">
          <span>Latitude</span>
          <input
            inputMode="decimal"
            aria-label={`Latitude for scenario ${index}`}
            value={draft.lat}
            onChange={(event) => onChange({ lat: event.target.value, siteId: CUSTOM_SITE_ID })}
            onBlur={() => snapDraftCoords(draft, sites, onChange)}
          />
        </label>
        <label className="field">
          <span>Longitude</span>
          <input
            inputMode="decimal"
            aria-label={`Longitude for scenario ${index}`}
            value={draft.lon}
            onChange={(event) => onChange({ lon: event.target.value, siteId: CUSTOM_SITE_ID })}
            onBlur={() => snapDraftCoords(draft, sites, onChange)}
          />
        </label>
      </div>
      <AmountField
        label="Window"
        amount={draft.windowAmount}
        unit={draft.windowUnit}
        limits={windowLimits}
        onAmount={(windowAmount) => onChange({ windowAmount })}
        onUnit={(windowUnit) => onChange({ windowUnit })}
      />
      <AmountField
        label="Night limit"
        amount={draft.nightAmount}
        unit={draft.nightUnit}
        limits={nightLimits}
        onAmount={(nightAmount) => onChange({ nightAmount })}
        onUnit={(nightUnit) => onChange({ nightUnit })}
      />
      <label className="field">
        <span>Touchdown (UTC)</span>
        <input
          type="datetime-local"
          step={1800}
          aria-label={`Touchdown for scenario ${index}`}
          value={draft.when}
          onChange={(event) => onChange({ when: event.target.value })}
        />
      </label>
    </section>
  );
}

function AmountField({
  label,
  amount,
  unit,
  limits,
  onAmount,
  onUnit,
}: {
  label: string;
  amount: string;
  unit: WindowUnit;
  limits: { min: number; max: number; step: number };
  onAmount: (amount: string) => void;
  onUnit: (unit: WindowUnit) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="compare-amount">
        <input
          type="number"
          aria-label={label}
          min={limits.min}
          max={limits.max}
          step={limits.step}
          value={amount}
          onChange={(event) => onAmount(event.target.value)}
        />
        <select aria-label={`${label} unit`} value={unit} onChange={(event) => onUnit(event.target.value as WindowUnit)}>
          <option value="minutes">Minutes</option>
          <option value="hours">Hours</option>
          <option value="days">Days</option>
        </select>
      </div>
    </label>
  );
}

function Results({
  scenarios,
  loads,
  sites,
  profiles,
  onUse,
  onEdit,
}: {
  scenarios: Scenario[];
  loads: ReturnType<typeof useScenarioLoad>[];
  sites: Site[];
  profiles: MissionProfile[];
  onUse: (scenario: Scenario) => void;
  onEdit: () => void;
}) {
  const rules = profiles.find((item) => item.id === "small-lander") ?? profiles[0];
  const currentMetrics = loads[0]?.mission?.metrics ?? null;
  return (
    <>
      <p className="card-subtitle">Side by side. Open one landing to see its sky and timeline on the page.</p>
      <div className="compare-setup">
        {scenarios.map((scenario, index) => {
          const load = loads[index];
          const profile = rules
            ? { ...rules, durationHours: scenario.durationHours, maxLongestDarkHours: scenario.maxNightHours }
            : null;
          const mission = load?.mission ?? null;
          const summary =
            mission && profile && mission.samples[0]
              ? summarize(
                  buildVerdict({
                    metrics: mission.metrics,
                    profile,
                    landing: mission.samples[0],
                    commMarginDeg: EARTH_COMM_MARGIN_DEG,
                  }),
                  mission.metrics,
                  profile,
                  mission.samples[0],
                )
              : null;
          const sentence =
            index > 0 && currentMetrics && mission && scenario.durationHours === scenarios[0]?.durationHours
              ? compare(currentMetrics, mission.metrics, placeName(scenario, sites), scenario.durationHours)
              : null;
          return (
            <article key={scenario.id} className={index === 0 ? "compare-card current" : "compare-card"}>
              <p className="compare-kicker">{index === 0 ? "Current" : `Scenario ${index + 1}`}</p>
              <h3>{placeName(scenario, sites)}</h3>
              <p className="compare-when-label">
                {whenFormat.format(new Date(scenario.landingUtc))} UTC · window {formatDuration(scenario.durationHours)} · night limit{" "}
                {formatDuration(scenario.maxNightHours)}
              </p>
              {!load || load.status === "loading" || load.status === "idle" ? (
                <p className="compare-status">{load?.message ?? "Asking JPL Horizons…"}</p>
              ) : load.status === "error" || !summary || !mission ? (
                <p className="compare-status error">{load.message ?? "This landing is not available."}</p>
              ) : (
                <>
                  <p className={`compare-title tone-${summary.tone}`}>{summary.title}</p>
                  <p className="compare-sentence">{summary.subtitle}</p>
                  <dl className="compare-stats">
                    <div>
                      <dt>Sunlight</dt>
                      <dd>{percent(mission.metrics.sunlitFraction)}</dd>
                    </div>
                    <div>
                      <dt>Earth</dt>
                      <dd>{percent(mission.metrics.earthFraction)}</dd>
                    </div>
                    <div>
                      <dt>Night</dt>
                      <dd>{formatDuration(mission.metrics.longestDarkHours)}</dd>
                    </div>
                    <div>
                      <dt>Sunset</dt>
                      <dd>{countdownValue(mission.metrics.sunsetInHours, "Stays up")}</dd>
                    </div>
                    <div>
                      <dt>Earthset</dt>
                      <dd>{countdownValue(mission.metrics.earthsetInHours, "Stays in view")}</dd>
                    </div>
                  </dl>
                  {sentence ? <p className="compare-sentence">{sentence}</p> : null}
                  {mission.terrainNote ? <p className="compare-status">{mission.terrainNote}</p> : null}
                </>
              )}
              <button type="button" className="dialog-close" onClick={() => onUse(scenario)}>
                {index === 0 ? "Keep as main" : "Full details"}
              </button>
            </article>
          );
        })}
      </div>
      <div className="compare-actions">
        <button type="button" className="compare-open" onClick={onEdit}>
          Edit scenarios
        </button>
      </div>
    </>
  );
}
