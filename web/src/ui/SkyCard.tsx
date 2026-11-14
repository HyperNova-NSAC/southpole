import { useState } from "react";
import type { HorizonMask, Instant } from "../contract/types";
import { HorizonPanorama } from "./charts/HorizonPanorama";
import { SkyDome } from "./charts/SkyDome";
import { playheadCaption } from "./present";
import { formatSigned } from "./result";
import { SegmentedControl } from "./SegmentedControl";

type View = "panorama" | "dome";

type SkyCardProps = {
  mask: HorizonMask;
  samples: Instant[];
  playhead: Instant | null;
  playheadIndex: number;
  playing: boolean;
  onPlay: (playing: boolean) => void;
  onSeek: (iso: string) => void;
};

/** The main visual: the sky from the landing site, with playback and live readouts. */
export function SkyCard({ mask, samples, playhead, playheadIndex, playing, onPlay, onSeek }: SkyCardProps) {
  const [view, setView] = useState<View>("panorama");
  const Chart = view === "panorama" ? HorizonPanorama : SkyDome;

  return (
    <section className="card sky">
      <div className="card-header">
        <div>
          <h2>Sky from the landing site</h2>
          <p className="card-subtitle">
            {mask.terrainIncluded
              ? "Skyline from the LOLA elevation model, Sun and Earth from JPL Horizons."
              : "Terrain unavailable here, so the horizon is drawn flat."}
          </p>
        </div>
        <SegmentedControl
          label="Chart view"
          options={[
            { value: "panorama", label: "Panorama" },
            { value: "dome", label: "Sky dome" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      <Chart mask={mask.maskElDeg} samples={samples} playhead={playhead} />

      <Legend />

      <div className="playback">
        <button
          type="button"
          className="play"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => onPlay(!playing)}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          type="range"
          className="scrubber"
          min={0}
          max={Math.max(0, samples.length - 1)}
          value={playheadIndex}
          onChange={(event) => {
            onPlay(false);
            onSeek(samples[Number(event.target.value)].t);
          }}
          aria-label="Playhead"
        />
        <span className="playback-time">{playhead ? playheadCaption(playhead.t) : "—"}</span>
      </div>

      {playhead ? <Readouts instant={playhead} /> : null}
    </section>
  );
}

function Legend() {
  return (
    <ul className="legend">
      <li>
        <i className="swatch sun" /> Sun path
      </li>
      <li>
        <i className="swatch sun off" /> Sun behind terrain
      </li>
      <li>
        <i className="swatch earth" /> Earth path
      </li>
      <li>
        <i className="swatch earth off" /> Earth out of view
      </li>
      <li>
        <i className="swatch ground" /> Terrain
      </li>
    </ul>
  );
}

/** Numbers for the moment under the playhead. */
function Readouts({ instant }: { instant: Instant }) {
  const items = [
    { label: "Sun elevation", value: `${instant.sunElDeg.toFixed(1)}°` },
    { label: "Sun vs skyline", value: formatSigned(instant.sunClearanceDeg) },
    { label: "Solar power", value: `${Math.round(instant.powerWm2)} W/m²` },
    { label: "Earth elevation", value: `${instant.earthElDeg.toFixed(1)}°` },
    { label: "Earth vs skyline", value: formatSigned(instant.earthClearanceDeg) },
    { label: "Radio link", value: instant.earthVisible ? "In view" : "Blocked" },
  ];
  return (
    <dl className="readouts">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
