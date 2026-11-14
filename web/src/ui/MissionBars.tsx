type MissionBarsProps = {
  powerFraction: number;
  earthFraction: number;
};

export function MissionBars({ powerFraction, earthFraction }: MissionBarsProps) {
  const sunlitDays = Math.round(powerFraction * 14);
  const earthPercent = Math.round(earthFraction * 100);

  return (
    <div className="bars">
      <div className="readout">
        <span className="readout-label">Power</span>
        <span className="meter power" aria-hidden="true">
          <i style={{ width: `${powerFraction * 100}%` }} />
        </span>
        <span className="readout-value">{sunlitDays} of 14 days</span>
      </div>
      <div className="readout">
        <span className="readout-label">Talk to Earth</span>
        <span className="meter earth" aria-hidden="true">
          <i style={{ width: `${earthFraction * 100}%` }} />
        </span>
        <span className="readout-value">{earthPercent}%</span>
      </div>
    </div>
  );
}
