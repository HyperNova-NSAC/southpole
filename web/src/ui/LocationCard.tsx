import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Site } from "../contract/types";
import { CUSTOM_SITE_ID } from "./query";

type LocationCardProps = {
  /** Catalog sites offered as presets. */
  sites: Site[];
  site: Site | null;
  landingUtc: string;
  onCoords: (latDeg: number, lonDegEast: number) => void;
  onPreset: (siteId: string) => void;
  onLanding: (landingUtc: string) => void;
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
export function LocationCard({ sites, site, landingUtc, onCoords, onPreset, onLanding }: LocationCardProps) {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [when, setWhen] = useState(toInputValue(landingUtc));

  // Keep the fields in step when the site changes from elsewhere (preset, tour, URL).
  useEffect(() => {
    if (!site) return;
    setLat(site.latDeg.toFixed(4));
    setLon(site.lonDegEast.toFixed(4));
  }, [site]);

  useEffect(() => setWhen(toInputValue(landingUtc)), [landingUtc]);

  const latValue = parseCoord(lat, 90);
  const lonValue = parseCoord(lon, 360);
  const coordsValid = latValue !== null && lonValue !== null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (coordsValid) onCoords(latValue, lonValue);
    const next = fromInputValue(when);
    if (next && next !== landingUtc) onLanding(next);
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
      </div>
    </form>
  );
}
