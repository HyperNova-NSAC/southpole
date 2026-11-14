import { useId, useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { areaRadial, lineRadial } from "d3-shape";
import type { Instant } from "../../contract/types";
import { Marker } from "./HorizonPanorama";
import { compassLabel, elevationDomain, polarPoint, splitTrack, type TrackPoint } from "./geometry";
import { earthTrack, sunTrack } from "./tracks";
import { useElementWidth } from "./useElementWidth";

type SkyDomeProps = {
  mask: number[];
  samples: Instant[];
  playhead: Instant | null;
  height?: number;
};

const RAD = Math.PI / 180;
const SPOKES = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * The same sky as a polar plot, looking straight up: north at the top,
 * the skyline around the edge, higher elevations toward the centre.
 */
export function SkyDome({ mask, samples, playhead, height = 440 }: SkyDomeProps) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const uid = useId().replace(/:/g, "");

  const sun = useMemo(() => sunTrack(samples), [samples]);
  const earth = useMemo(() => earthTrack(samples), [samples]);
  const sunRuns = useMemo(() => splitTrack(sun, false), [sun]);
  const earthRuns = useMemo(() => splitTrack(earth, false), [earth]);

  const radius = Math.max(0, Math.min(width, height) / 2 - 34);
  const [low, high] = elevationDomain(mask, [sun, earth]);
  // Elevation maps to distance from the centre: the top of the range sits at the centre.
  const r = scaleLinear().domain([high, low]).range([0, radius]).clamp(true);

  const ring = mask.length > 0 ? [...mask, mask[0]] : [];
  const terrainPath =
    areaRadial<number>()
      .angle((_, i) => i * RAD)
      .innerRadius(radius)
      .outerRadius((el) => r(el))(ring) ?? "";
  const trackPath = lineRadial<TrackPoint>()
    .angle((p) => p.azDeg * RAD)
    .radius((p) => r(p.elDeg));

  const at = (azDeg: number, elDeg: number) => polarPoint(azDeg, r(elDeg));

  return (
    <div ref={containerRef} className="chart">
      {width > 0 ? (
        <svg width={width} height={height} role="img" aria-label="Sky dome looking straight up">
          <defs>
            <radialGradient id={`dome-${uid}`}>
              <stop offset="0%" className="stop-sky-top" />
              <stop offset="100%" className="stop-sky-bottom" />
            </radialGradient>
            <clipPath id={`disc-${uid}`}>
              <circle r={radius} />
            </clipPath>
          </defs>

          <g transform={`translate(${width / 2},${height / 2})`}>
            <circle r={radius} fill={`url(#dome-${uid})`} />

            {/* Elevation rings */}
            {r.ticks(4).map((tick) => (
              <g key={tick}>
                <circle r={r(tick)} className={tick === 0 ? "grid zero" : "grid"} fill="none" />
                <text x={4} y={-r(tick) - 4} className="axis-label">
                  {tick}°
                </text>
              </g>
            ))}

            {/* Compass spokes */}
            {SPOKES.map((az) => {
              const end = polarPoint(az, radius);
              const label = polarPoint(az, radius + 18);
              return (
                <g key={az}>
                  <line x2={end.x} y2={end.y} className="grid faint" />
                  <text x={label.x} y={label.y} dy="0.32em" textAnchor="middle" className="axis-label strong">
                    {compassLabel(az)}
                  </text>
                </g>
              );
            })}

            <g clipPath={`url(#disc-${uid})`}>
              <path d={terrainPath} className="dome-ground" />
              {earthRuns.map((run, i) => (
                <path key={`e${i}`} d={trackPath(run.points) ?? ""} className={run.on ? "track earth" : "track earth off"} />
              ))}
              {sunRuns.map((run, i) => (
                <path key={`s${i}`} d={trackPath(run.points) ?? ""} className={run.on ? "track sun" : "track sun off"} />
              ))}
            </g>
            <circle r={radius} className="dome-edge" fill="none" />

            {playhead ? (
              <>
                <Marker
                  {...at(playhead.earthAzDeg, playhead.earthElDeg)}
                  kind="earth"
                  visible={playhead.earthVisible}
                  label="Earth"
                />
                <Marker
                  {...at(playhead.sunAzDeg, playhead.sunElDeg)}
                  kind="sun"
                  visible={playhead.sunFrac >= 0.5}
                  label="Sun"
                />
              </>
            ) : null}
          </g>
        </svg>
      ) : null}
    </div>
  );
}
