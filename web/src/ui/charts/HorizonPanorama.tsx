import { useId, useMemo, useState } from "react";
import type { PointerEvent } from "react";
import { scaleLinear } from "d3-scale";
import { area, curveMonotoneX, line } from "d3-shape";
import type { Instant } from "../../contract/types";
import { compassLabel, discRadiusPx, elevationDomain, pxPerDeg, splitTrack, type TrackPoint } from "./geometry";
import { earthTrack, sunTrack } from "./tracks";
import { useElementWidth } from "./useElementWidth";

type HorizonPanoramaProps = {
  /** Skyline elevation for each whole degree of azimuth (360 values). */
  mask: number[];
  samples: Instant[];
  playhead: Instant | null;
  height?: number;
};

const MARGIN = { top: 24, right: 24, bottom: 40, left: 52 };
const AZ_TICKS = [0, 45, 90, 135, 180, 225, 270, 315, 360];

/**
 * A 360° unrolled view of the sky from the landing site: terrain silhouette,
 * the Sun and Earth paths over the mission, and where both are at the playhead.
 */
export function HorizonPanorama({ mask, samples, playhead, height = 440 }: HorizonPanoramaProps) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  const [hoverAz, setHoverAz] = useState<number | null>(null);
  const uid = useId().replace(/:/g, "");

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const sun = useMemo(() => sunTrack(samples), [samples]);
  const earth = useMemo(() => earthTrack(samples), [samples]);
  const sunRuns = useMemo(() => splitTrack(sun, true), [sun]);
  const earthRuns = useMemo(() => splitTrack(earth, true), [earth]);

  const x = scaleLinear().domain([0, 360]).range([0, innerW]);
  const y = scaleLinear().domain(elevationDomain(mask, [sun, earth])).range([innerH, 0]).nice();

  // Repeat azimuth 0 at 360 so the silhouette spans the full width.
  const ring = mask.length > 0 ? [...mask, mask[0]] : [];
  const terrainPath =
    area<number>()
      .x((_, i) => x(i))
      .y0(innerH)
      .y1((el) => y(el))
      .curve(curveMonotoneX)(ring) ?? "";
  const ridgePath =
    line<number>()
      .x((_, i) => x(i))
      .y((el) => y(el))
      .curve(curveMonotoneX)(ring) ?? "";
  const trackPath = line<TrackPoint>()
    .x((p) => x(p.azDeg))
    .y((p) => y(p.elDeg));

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left - MARGIN.left;
    setHoverAz(px >= 0 && px <= innerW ? Math.round(x.invert(px)) % 360 : null);
  }

  const clampToPlot = (px: number, py: number) => {
    const cx = Math.max(0, Math.min(innerW, px));
    const anchor = cx < 24 ? "start" : cx > innerW - 24 ? "end" : "middle";
    return { x: cx, y: Math.max(0, Math.min(innerH, py)), anchor } as const;
  };

  const hoverRidge = hoverAz === null ? undefined : mask[hoverAz];
  // Disc sizes are read off the elevation axis, which is the one compared to the skyline.
  const [elLow, elHigh] = y.domain();
  const scale = pxPerDeg(Math.abs(y(elLow) - y(elHigh)), elHigh - elLow);

  return (
    <div ref={containerRef} className="chart">
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Panorama of the skyline with the Sun and Earth paths"
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHoverAz(null)}
        >
          <defs>
            <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="stop-sky-top" />
              <stop offset="100%" className="stop-sky-bottom" />
            </linearGradient>
            <linearGradient id={`ground-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="stop-ground-top" />
              <stop offset="100%" className="stop-ground-bottom" />
            </linearGradient>
            <clipPath id={`plot-${uid}`}>
              <rect width={innerW} height={innerH} />
            </clipPath>
          </defs>

          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            <rect width={innerW} height={innerH} rx={12} fill={`url(#sky-${uid})`} />

            {/* Elevation grid and axis */}
            {y.ticks(6).map((tick) => (
              <g key={tick} transform={`translate(0,${y(tick)})`}>
                <line x2={innerW} className={tick === 0 ? "grid zero" : "grid"} />
                <text x={-10} dy="0.32em" className="axis-label" textAnchor="end">
                  {tick}°
                </text>
              </g>
            ))}

            {/* Azimuth grid and compass labels */}
            {AZ_TICKS.map((az) => (
              <g key={az} transform={`translate(${x(az)},0)`}>
                <line y2={innerH} className="grid faint" />
                <text y={innerH + 24} className="axis-label strong" textAnchor="middle">
                  {compassLabel(az)}
                </text>
              </g>
            ))}

            <g clipPath={`url(#plot-${uid})`}>
              <path d={terrainPath} fill={`url(#ground-${uid})`} />
              <path d={ridgePath} className="ridge" />

              {earthRuns.map((run, i) => (
                <path key={`e${i}`} d={trackPath(run.points) ?? ""} className={run.on ? "track earth" : "track earth off"} />
              ))}
              {sunRuns.map((run, i) => (
                <path key={`s${i}`} d={trackPath(run.points) ?? ""} className={run.on ? "track sun" : "track sun off"} />
              ))}
            </g>

            {/* Markers sit outside the clip so their labels never get cut at the edges. */}
            {playhead ? (
              <>
                <Marker
                  {...clampToPlot(x(playhead.earthAzDeg), y(playhead.earthElDeg))}
                  kind="earth"
                  visible={playhead.earthVisible}
                  label="Earth"
                  radius={discRadiusPx(scale, playhead.earthAngDiamDeg)}
                />
                <Marker
                  {...clampToPlot(x(playhead.sunAzDeg), y(playhead.sunElDeg))}
                  kind="sun"
                  visible={playhead.sunFrac >= 0.5}
                  label="Sun"
                  radius={discRadiusPx(scale, playhead.sunAngDiamDeg)}
                />
              </>
            ) : null}

            {hoverAz !== null && hoverRidge !== undefined ? (
              <g transform={`translate(${x(hoverAz)},0)`} className="hover" pointerEvents="none">
                <line y2={innerH} />
                <circle cy={y(hoverRidge)} r={4} />
                <g transform={`translate(${x(hoverAz) > innerW - 150 ? -142 : 10},10)`}>
                  <rect width={132} height={44} rx={10} />
                  <text x={12} y={19} className="tip-title">
                    {hoverAz}° {compassLabel(hoverAz)}
                  </text>
                  <text x={12} y={35} className="tip-body">
                    Skyline at {hoverRidge.toFixed(1)}°
                  </text>
                </g>
              </g>
            ) : null}
          </g>
        </svg>
      ) : null}
    </div>
  );
}

type MarkerProps = {
  x: number;
  y: number;
  kind: "sun" | "earth";
  visible: boolean;
  label: string;
  /** Pixel radius matching the angular radius on the elevation scale. */
  radius: number;
  anchor?: "start" | "middle" | "end";
};

/** The Sun or Earth at the playhead: the same halo and dot as before, sized to the angular radius. */
export function Marker({ x, y, kind, visible, label, radius, anchor = "middle" }: MarkerProps) {
  return (
    <g transform={`translate(${x},${y})`} className={`marker ${kind} ${visible ? "" : "hidden"}`}>
      <circle r={radius * 2} className="halo" />
      <circle r={radius} className="disc" />
      <text y={-(radius * 2 + 4)} textAnchor={anchor} className="marker-label">
        {label}
      </text>
    </g>
  );
}
