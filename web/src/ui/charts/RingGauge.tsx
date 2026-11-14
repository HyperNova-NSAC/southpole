import { arc } from "d3-shape";

type RingGaugeProps = {
  /** 0..1 */
  fraction: number;
  tone: "sun" | "earth";
  size?: number;
};

/** A small Apple Watch–style activity ring for a percentage metric. */
export function RingGauge({ fraction, tone, size = 56 }: RingGaugeProps) {
  const outer = size / 2;
  const inner = outer - 7;
  const shape = arc().cornerRadius(4);
  const track = shape({ innerRadius: inner, outerRadius: outer, startAngle: 0, endAngle: 2 * Math.PI }) ?? "";
  const value =
    shape({
      innerRadius: inner,
      outerRadius: outer,
      startAngle: 0,
      endAngle: 2 * Math.PI * Math.min(1, Math.max(0, fraction)),
    }) ?? "";

  return (
    <svg width={size} height={size} className={`ring ${tone}`} aria-hidden="true">
      <g transform={`translate(${outer},${outer})`}>
        <path d={track} className="ring-track" />
        {fraction > 0 ? <path d={value} className="ring-value" /> : null}
      </g>
    </svg>
  );
}
