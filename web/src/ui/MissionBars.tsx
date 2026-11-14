type MissionBarsProps = {
  powerFraction: number;
  earthFraction: number;
};

export function MissionBars({ powerFraction, earthFraction }: MissionBarsProps) {
  return (
    <div className="bars">
      <span>
        Power
        <span className="meter power" aria-hidden="true">
          <i style={{ width: `${powerFraction * 100}%` }} />
        </span>
      </span>
      <span>
        Talk to Earth
        <span className="meter earth" aria-hidden="true">
          <i style={{ width: `${earthFraction * 100}%` }} />
        </span>
      </span>
    </div>
  );
}
