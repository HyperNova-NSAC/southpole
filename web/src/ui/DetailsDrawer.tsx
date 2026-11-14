import { useState } from "react";
import type { Instant, Links } from "../contract/types";
import { playheadCaption } from "./present";
import { SourceFooter } from "./SourceFooter";

type DetailsDrawerProps = {
  ready: boolean;
  playhead: Instant | null;
  reasons: string[];
  dates: string[];
  suggestion: { siteId: string; sentence: string } | null;
  suggestionStatus: "idle" | "loading" | "ready";
  links: Links;
  lat: number;
  lon: number;
  onLanding: (landingUtc: string) => void;
  onCompare: (siteId: string) => void;
  onLookup: (lat: number, lon: number) => void;
};

function degrees(value: number): string {
  return `${value.toFixed(1)}°`;
}

export function DetailsDrawer({
  ready,
  playhead,
  reasons,
  dates,
  suggestion,
  suggestionStatus,
  links,
  lat,
  lon,
  onLanding,
  onCompare,
  onLookup,
}: DetailsDrawerProps) {
  const [latText, setLatText] = useState("");
  const [lonText, setLonText] = useState("");

  return (
    <section className="drawer" aria-label="Numbers">
      <h2>This moment</h2>
      {playhead ? (
        <table>
          <tbody>
            <tr>
              <th scope="row">Sun height above a flat horizon</th>
              <td>{degrees(playhead.sunElDeg)}</td>
            </tr>
            <tr>
              <th scope="row">Sun height above the ridge</th>
              <td>{degrees(playhead.sunClearanceDeg)}</td>
            </tr>
            <tr>
              <th scope="row">Earth height above a flat horizon</th>
              <td>{degrees(playhead.earthElDeg)}</td>
            </tr>
            <tr>
              <th scope="row">Earth height above the ridge</th>
              <td>{degrees(playhead.earthClearanceDeg)}</td>
            </tr>
            <tr>
              <th scope="row">Illustrative power</th>
              <td>{playhead.powerWm2.toFixed(1)} W/m²</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p>The numbers appear once this place has loaded.</p>
      )}

      <h2>Why this sentence</h2>
      {!ready ? (
        <p>The reasons appear once this place has loaded.</p>
      ) : reasons.length > 0 ? (
        <ul>
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : (
        <p>This window is inside the limits.</p>
      )}

      <h2>What if the launch slips?</h2>
      {!ready ? (
        <p>The dates appear once this place has loaded.</p>
      ) : dates.length > 0 ? (
        <div className="choice-row">
          {dates.map((iso) => (
            <button key={iso} type="button" onClick={() => onLanding(iso)}>
              Land on {playheadCaption(iso)}
            </button>
          ))}
        </div>
      ) : (
        <p>No other date in this table stays inside the limits.</p>
      )}

      <h2>A different place</h2>
      {suggestionStatus === "loading" || suggestionStatus === "idle" ? (
        <p>Looking at the other places…</p>
      ) : suggestion ? (
        <button type="button" onClick={() => onCompare(suggestion.siteId)}>
          {suggestion.sentence}
        </button>
      ) : (
        <p>No other catalog place stays inside the limits for this date.</p>
      )}

      <h2>A place you type</h2>
      <form
        className="lookup"
        onSubmit={(event) => {
          event.preventDefault();
          const latDeg = Number(latText);
          const lonDeg = Number(lonText);
          if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) return;
          onLookup(latDeg, lonDeg);
        }}
      >
        <label className="field">
          <span>Latitude</span>
          <input
            type="number"
            required
            min={-90}
            max={90}
            step="0.01"
            aria-label="Latitude"
            value={latText}
            onChange={(event) => setLatText(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Longitude, east positive</span>
          <input
            type="number"
            required
            min={-180}
            max={180}
            step="0.01"
            aria-label="Longitude, east positive"
            value={lonText}
            onChange={(event) => setLonText(event.target.value)}
          />
        </label>
        <button type="submit">Look up this place</button>
      </form>

      <SourceFooter links={links} lat={lat} lon={lon} />
    </section>
  );
}
