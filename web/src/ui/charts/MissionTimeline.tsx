import { useId, useMemo, useRef } from "react";
import type { PointerEvent } from "react";
import { scaleLinear, scaleUtc } from "d3-scale";
import { line } from "d3-shape";
import type { Instant } from "../../contract/types";
import { SUNLIT_THRESHOLD } from "../../core/evaluate";
import { nearestIndex, runsWhere } from "./geometry";
import { useElementWidth } from "./useElementWidth";

type MissionTimelineProps = {
  samples: Instant[];
  playheadUtc: string;
  onSeek: (iso: string) => void;
};

const MARGIN = { top: 16, right: 24, bottom: 28, left: 92 };
const CHART_H = 150;
const LANE_H = 14;
const LANE_GAP = 10;
const HEIGHT = MARGIN.top + CHART_H + 2 * (LANE_H + LANE_GAP) + MARGIN.bottom + 8;
const STEP_MS = 30 * 60 * 1000;

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * The whole mission on one axis: how far the Sun and Earth clear the skyline
 * (0° is the skyline itself), plus two lanes showing when there is sunlight
 * and when Earth is in contact. Click or drag to move the playhead.
 */
export function MissionTimeline(props: MissionTimelineProps) {
  const [containerRef, width] = useElementWidth<HTMLDivElement>();
  return (
    <div ref={containerRef} className="chart">
      {width > 0 && props.samples.length > 0 ? <TimelinePlot {...props} width={width} /> : null}
    </div>
  );
}

function TimelinePlot({ samples, playheadUtc, onSeek, width }: MissionTimelineProps & { width: number }) {
  const dragging = useRef(false);
  const uid = useId().replace(/:/g, "");

  const times = useMemo(() => samples.map((s) => Date.parse(s.t)), [samples]);
  const litRuns = useMemo(() => runsWhere(samples.map((s) => s.sunFrac >= SUNLIT_THRESHOLD)), [samples]);
  const darkRuns = useMemo(() => runsWhere(samples.map((s) => s.sunFrac < SUNLIT_THRESHOLD)), [samples]);
  const earthRuns = useMemo(() => runsWhere(samples.map((s) => s.earthVisible)), [samples]);

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const start = times[0];
  const end = times[times.length - 1] + STEP_MS;
  const x = scaleUtc().domain([start, end]).range([0, innerW]);

  // Clearances can swing far below the skyline; keep the interesting band around 0°.
  const clearances = samples.flatMap((s) => [s.sunClearanceDeg, s.earthClearanceDeg]);
  const low = Math.max(-15, Math.min(-3, ...clearances));
  const high = Math.min(40, Math.max(3, ...clearances));
  const y = scaleLinear().domain([low, high]).range([CHART_H, 0]).nice();

  const clearanceLine = (pick: (s: Instant) => number) =>
    line<Instant>()
      .x((_, i) => x(times[i]))
      .y((s) => y(pick(s)))(samples) ?? "";

  const laneY = (lane: number) => CHART_H + LANE_GAP + lane * (LANE_H + LANE_GAP);
  const runRect = (run: { start: number; end: number }) => ({
    x: x(times[run.start]),
    width: Math.max(1, x(times[run.end - 1] + STEP_MS) - x(times[run.start])),
  });

  const playX = x(Date.parse(playheadUtc));

  function seek(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const px = Math.max(0, Math.min(innerW, event.clientX - box.left - MARGIN.left));
    onSeek(samples[nearestIndex(times, x.invert(px).getTime())].t);
  }

  return (
    <svg
      width={width}
      height={HEIGHT}
      className="timeline"
      role="slider"
      aria-label="Mission timeline"
      aria-valuemin={start}
      aria-valuemax={end}
      aria-valuenow={Date.parse(playheadUtc)}
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        seek(event);
      }}
      onPointerMove={(event) => dragging.current && seek(event)}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      <defs>
        <clipPath id={`tl-${uid}`}>
          <rect width={innerW} height={CHART_H} />
        </clipPath>
      </defs>
      <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
        {/* Night bands behind the lines */}
        {darkRuns.map((run) => (
          <rect key={run.start} {...runRect(run)} height={CHART_H} className="night-band" />
        ))}

        {y.ticks(4).map((tick) => (
          <g key={tick} transform={`translate(0,${y(tick)})`}>
            <line x2={innerW} className={tick === 0 ? "grid zero" : "grid"} />
            <text x={-10} dy="0.32em" textAnchor="end" className="axis-label">
              {tick === 0 ? "Skyline" : `${tick}°`}
            </text>
          </g>
        ))}

        <g clipPath={`url(#tl-${uid})`}>
          <path d={clearanceLine((s) => s.earthClearanceDeg)} className="track earth" />
          <path d={clearanceLine((s) => s.sunClearanceDeg)} className="track sun" />
        </g>

        {/* Lanes: when there is power and when there is contact */}
        <text x={-10} y={laneY(0) + LANE_H / 2} dy="0.32em" textAnchor="end" className="axis-label">
          Sunlight
        </text>
        <rect y={laneY(0)} width={innerW} height={LANE_H} rx={LANE_H / 2} className="lane" />
        {litRuns.map((run) => (
          <rect key={run.start} {...runRect(run)} y={laneY(0)} height={LANE_H} rx={3} className="lane-fill sun" />
        ))}

        <text x={-10} y={laneY(1) + LANE_H / 2} dy="0.32em" textAnchor="end" className="axis-label">
          Earth contact
        </text>
        <rect y={laneY(1)} width={innerW} height={LANE_H} rx={LANE_H / 2} className="lane" />
        {earthRuns.map((run) => (
          <rect key={run.start} {...runRect(run)} y={laneY(1)} height={LANE_H} rx={3} className="lane-fill earth" />
        ))}

        {x.ticks(Math.max(2, Math.floor(innerW / 90))).map((tick) => (
          <text key={tick.getTime()} x={x(tick)} y={laneY(2) + 6} textAnchor="middle" className="axis-label">
            {dayFormat.format(tick)}
          </text>
        ))}

        <g transform={`translate(${playX},0)`} className="playhead" pointerEvents="none">
          <line y1={-6} y2={laneY(2) - LANE_GAP + 4} />
          <circle cy={-6} r={5} />
        </g>
      </g>
    </svg>
  );
}
