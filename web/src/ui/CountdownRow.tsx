type CountdownRowProps = {
  sunset: string;
  earthset: string;
  playing: boolean;
  caption: string;
  playDisabled: boolean;
  onTogglePlay: () => void;
};

export function CountdownRow({
  sunset,
  earthset,
  playing,
  caption,
  playDisabled,
  onTogglePlay,
}: CountdownRowProps) {
  return (
    <div className="timing">
      <div className="countdown">
        <p>{sunset}</p>
        <p>{earthset}</p>
      </div>
      <div className="playhead">
        <button type="button" onClick={onTogglePlay} disabled={playDisabled}>
          {playing ? "Stop" : "Play"}
        </button>
        <p>{caption}</p>
      </div>
    </div>
  );
}
