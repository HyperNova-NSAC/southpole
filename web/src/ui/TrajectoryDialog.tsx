import { useEffect, useMemo, useRef, useState } from "react";
import { MOON_DISTANCE_KM, coastPath, planTransfer, stateAt, type CraftState } from "../core/transfer";

type TrajectoryDialogProps = {
  place: string;
  arrivalUtc: string;
  onClose: () => void;
};

const CX = 320;
const CY = 268;
const ORBIT = 188;
const FLIGHT_MS = 14_000;

const whenFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function stamp(ms: number): string {
  return `${whenFormat.format(new Date(ms))} UTC`;
}

function project(longitudeDeg: number, radiusKm: number): [number, number] {
  const radius = (radiusKm / MOON_DISTANCE_KM) * ORBIT;
  const angle = (longitudeDeg * Math.PI) / 180;
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)];
}

function line(points: CraftState[], radiusOf: (point: CraftState) => number, longitudeOf: (point: CraftState) => number): string {
  return points
    .map((point) => {
      const [x, y] = project(longitudeOf(point), radiusOf(point));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function TrajectoryDialog({ place, arrivalUtc, onClose }: TrajectoryDialogProps) {
  const plan = useMemo(() => planTransfer(arrivalUtc), [arrivalUtc]);
  const path = useMemo(() => coastPath(plan), [plan]);
  const [fraction, setFraction] = useState(0);
  const [playing, setPlaying] = useState(false);
  const fractionRef = useRef(0);
  fractionRef.current = fraction;

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = Math.min(1, fractionRef.current + (now - last) / FLIGHT_MS);
      last = now;
      fractionRef.current = next;
      setFraction(next);
      if (next >= 1) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const now = stateAt(plan, fraction);
  const liftoff = stateAt(plan, 0);
  const [rocketX, rocketY] = project(now.rocketLongitudeDeg, now.rocketRadiusKm);
  const [moonX, moonY] = project(now.moonLongitudeDeg, MOON_DISTANCE_KM);
  const [ghostX, ghostY] = project(liftoff.moonLongitudeDeg, MOON_DISTANCE_KM);
  const rocketPath = line(path, (point) => point.rocketRadiusKm, (point) => point.rocketLongitudeDeg);
  const moonPath = line(
    Array.from({ length: 49 }, (_, index) => stateAt(plan, index / 48)),
    () => MOON_DISTANCE_KM,
    (point) => point.moonLongitudeDeg,
  );

  function togglePlay() {
    if (fraction >= 0.999) {
      fractionRef.current = 0;
      setFraction(0);
      setPlaying(true);
      return;
    }
    setPlaying((value) => !value);
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog trajectory-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trajectory-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="trajectory-title">Rocket trajectory</h2>
        <p className="card-subtitle">
          A viable landing at {place}. The rocket meets the Moon at {stamp(plan.arrivalMs)}.
        </p>
        <dl className="trajectory-facts">
          <div>
            <dt>Liftoff</dt>
            <dd>{stamp(plan.liftoffMs)}</dd>
          </div>
          <div>
            <dt>Leave Earth orbit</dt>
            <dd>{stamp(plan.departureMs)}</dd>
          </div>
          <div>
            <dt>Arrive at the Moon</dt>
            <dd>{stamp(plan.arrivalMs)}</dd>
          </div>
        </dl>
        <svg className="trajectory-plot" viewBox="0 0 640 520" role="img" aria-label="Earth and Moon from above the ecliptic">
          <circle cx={CX} cy={CY} r={ORBIT} className="trajectory-orbit" />
          <polyline points={moonPath} className="trajectory-moon-path" />
          <polyline points={rocketPath} className="trajectory-rocket-path" />
          {fraction > 0.04 ? (
            <g className="trajectory-ghost">
              <circle cx={ghostX} cy={ghostY} r={7} />
              <text x={ghostX} y={ghostY - 16} textAnchor="middle">
                Moon at liftoff
              </text>
            </g>
          ) : null}
          <g className="trajectory-moon">
            <circle cx={moonX} cy={moonY} r={8} />
            <text x={moonX} y={moonY - 16} textAnchor="middle">
              Moon
            </text>
          </g>
          <g className="trajectory-earth">
            <circle cx={CX} cy={CY} r={16} />
            <text x={CX} y={CY + 32} textAnchor="middle">
              Earth
            </text>
          </g>
          <circle cx={rocketX} cy={rocketY} r={4.5} className="trajectory-rocket" />
        </svg>
        <ul className="legend trajectory-legend">
          <li>
            <i className="swatch sun" /> Rocket path
          </li>
          <li>
            <i className="swatch earth" /> Earth
          </li>
          <li>
            <i className="swatch off" /> Moon
          </li>
        </ul>
        <div className="playback">
          <button type="button" className="play" aria-label={playing ? "Pause" : "Play"} onClick={togglePlay}>
            {playing ? "❚❚" : "▶"}
          </button>
          <input
            type="range"
            className="scrubber"
            min={0}
            max={1000}
            step={1}
            value={Math.round(fraction * 1000)}
            aria-label="Flight"
            onChange={(event) => {
              const next = Number(event.target.value) / 1000;
              fractionRef.current = next;
              setFraction(next);
              setPlaying(false);
            }}
          />
          <span className="playback-time">{stamp(now.utcMs)}</span>
        </div>
        <p className="trajectory-note">
          The coast is a Hohmann transfer from a 185 km orbit to the Moon’s mean distance, aimed so the two meet.
          Liftoff is {plan.parkingHours} hours before that burn. Looking down from the north ecliptic pole. Earth is
          drawn larger than scale.
        </p>
        <button type="button" className="dialog-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
