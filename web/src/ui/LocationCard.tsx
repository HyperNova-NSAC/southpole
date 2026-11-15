import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Site } from "../contract/types";
import {
  CUSTOM_SITE_ID,
  durationHoursFromAmount,
  formatWindowAmount,
  windowFieldLimits,
  windowUnit,
  type WindowUnit,
} from "./query";

type LocationCardProps = {
  /** Catalog sites offered as presets. */
  sites: Site[];
  site: Site | null;
  landingUtc: string;
  durationHours: number;
  maxNightHours: number;
  onDuration: (durationHours: number) => void;
  onNightLimit: (maxNightHours: number) => void;
  onCoords: (latDeg: number, lonDegEast: number) => void;
  onPreset: (siteId: string) => void;
  onLanding: (landingUtc: string) => void;
  /** Opens the window for comparing this landing with one or two others. */
  onCompare?: () => void;
};

/** "2027-03-03T00:00:00Z" → "2027-03-03T00:00" for a datetime-local input. */
function toInputValue(iso: string): string {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "" : new Date(ms).toISOString().slice(0, 16);
}

/** The datetime-local value is read as UTC, matching the Horizons tables. */
function fromInputValue(value: string): string | null {
  const ms = Date.parse(`${value}:00Z`);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function parseCoord(text: string, limit: number): number | null {
  const value = Number.parseFloat(text);
  return Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
}

/**
 * The two inputs that define a landing: where (latitude, longitude) and when (UTC).
 * Typed coordinates near a catalog site snap to it; the preset menu fills them in.
 */
export function LocationCard({
  sites,
  site,
  landingUtc,
  durationHours,
  maxNightHours,
  onDuration,
  onNightLimit,
  onCoords,
  onPreset,
  onLanding,
  onCompare,
}: LocationCardProps) {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [when, setWhen] = useState(toInputValue(landingUtc));

  // Keep the fields in step when the site changes from elsewhere (preset, URL).
  useEffect(() => {
    if (!site) return;
    setLat(site.latDeg.toFixed(4));
    setLon(site.lonDegEast.toFixed(4));
  }, [site]);

  useEffect(() => setWhen(toInputValue(landingUtc)), [landingUtc]);

  const latValue = parseCoord(lat, 90);
  const lonValue = parseCoord(lon, 360);
  const coordsValid = latValue !== null && lonValue !== null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (coordsValid) onCoords(latValue, lonValue);
    const next = fromInputValue(when);
    if (next && next !== landingUtc) onLanding(next);
    commitNamed(event.currentTarget, "windowLength", durationHours, onDuration);
    commitNamed(event.currentTarget, "nightLimit", maxNightHours, onNightLimit);
  }

  const isCustom = site?.id === CUSTOM_SITE_ID;

  return (
    <form className="card location" onSubmit={submit}>
      <div className="card-header">
        <h2>Landing</h2>
        <label className="preset">
          <span className="sr-only">Known sites</span>
          <select
            value={isCustom || !site ? "" : site.id}
            onChange={(event) => event.target.value && onPreset(event.target.value)}
          >
            <option value="" disabled>
              Known sites…
            </option>
            {sites.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="fields">
        <label className={latValue === null ? "field invalid" : "field"}>
          <span>Latitude</span>
          <div className="input-wrap">
            <input
              inputMode="decimal"
              value={lat}
              onChange={(event) => setLat(event.target.value)}
              aria-label="Latitude in degrees"
            />
            <em>°N</em>
          </div>
        </label>
        <label className={lonValue === null ? "field invalid" : "field"}>
          <span>Longitude</span>
          <div className="input-wrap">
            <input
              inputMode="decimal"
              value={lon}
              onChange={(event) => setLon(event.target.value)}
              aria-label="Longitude in degrees east"
            />
            <em>°E</em>
          </div>
        </label>
        <DurationField
          label="Window"
          name="windowLength"
          hours={durationHours}
          onChange={onDuration}
        />
        <DurationField
          label="Night limit"
          name="nightLimit"
          hours={maxNightHours}
          onChange={onNightLimit}
        />
        <label className="field wide">
          <span>Touchdown (UTC)</span>
          <div className="input-wrap">
            <input
              type="datetime-local"
              step={1800}
              value={when}
              onChange={(event) => setWhen(event.target.value)}
              onBlur={() => {
                const next = fromInputValue(when);
                if (next && next !== landingUtc) onLanding(next);
              }}
            />
          </div>
        </label>
        <button type="submit" className="button primary" disabled={!coordsValid}>
          Check landing
        </button>
      </div>

      <div className="location-foot">
        {site ? (
          <span className={isCustom ? "badge" : "badge matched"}>
            {isCustom ? "Custom location" : site.name}
          </span>
        ) : null}
        <span className="hint">
          {isCustom
            ? "Terrain is computed live from the LOLA elevation model."
            : "Typed points within 2 km of a known site use that site."}
        </span>
        {onCompare ? (
          <button type="button" className="button secondary" onClick={onCompare}>
            Compare against
          </button>
        ) : null}
      </div>
    </form>
  );
}

/** A length in minutes, hours, or days. Commits on blur and when the unit changes. */
function DurationField({
  label,
  name,
  hours,
  onChange,
}: {
  label: string;
  name: string;
  hours: number;
  onChange: (hours: number) => void;
}) {
  const [unit, setUnit] = useState<WindowUnit>(() => windowUnit(hours));
  const [amount, setAmount] = useState(() => formatWindowAmount(hours, windowUnit(hours)));
  const unitRef = useRef(unit);
  unitRef.current = unit;
  const limits = windowFieldLimits(unit);

  // A shared link or a clamp refreshes the number. Changing the unit does not.
  useEffect(() => setAmount(formatWindowAmount(hours, unitRef.current)), [hours]);

  function commit(raw: string) {
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) {
      setAmount(formatWindowAmount(hours, unit));
      return;
    }
    const next = durationHoursFromAmount(parsed, unit);
    setAmount(formatWindowAmount(next, unit));
    if (Math.round(next * 60) !== Math.round(hours * 60)) onChange(next);
  }

  function changeUnit(next: WindowUnit) {
    setUnit(next);
    const parsed = Number.parseFloat(amount);
    if (!Number.isFinite(parsed)) return;
    // The typed number stays put. 14 hours becomes 14 days, not 0.58 days.
    const nextHours = durationHoursFromAmount(parsed, next);
    setAmount(formatWindowAmount(nextHours, next));
    if (Math.round(nextHours * 60) !== Math.round(hours * 60)) onChange(nextHours);
  }

  return (
    <label className="field wide">
      <span>{label}</span>
      <div className="input-wrap">
        <input
          name={name}
          type="number"
          inputMode={unit === "minutes" ? "numeric" : "decimal"}
          min={limits.min}
          max={limits.max}
          step={limits.step}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          onBlur={(event) => {
            if (event.target instanceof HTMLInputElement) commit(event.target.value);
          }}
          aria-label={label}
        />
        <select
          name={`${name}-unit`}
          className="unit"
          aria-label={`${label} unit`}
          value={unit}
          onChange={(event) => changeUnit(event.target.value as WindowUnit)}
        >
          <option value="minutes">Minutes</option>
          <option value="hours">Hours</option>
          <option value="days">Days</option>
        </select>
      </div>
    </label>
  );
}

/** Read a duration field from the submitted form, including a value React state has not seen yet. */
function commitNamed(
  form: HTMLFormElement,
  name: string,
  currentHours: number,
  onChange: (hours: number) => void,
) {
  const field = form.elements.namedItem(name);
  const unitField = form.elements.namedItem(`${name}-unit`);
  if (!(field instanceof HTMLInputElement) || !(unitField instanceof HTMLSelectElement)) return;
  const parsed = Number.parseFloat(field.value);
  if (!Number.isFinite(parsed)) return;
  const next = durationHoursFromAmount(parsed, unitField.value as WindowUnit);
  if (Math.round(next * 60) !== Math.round(currentHours * 60)) onChange(next);
}
