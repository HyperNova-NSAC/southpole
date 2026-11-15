const LIMITS = [
  "Sun and Earth positions come from JPL Horizons and do not include terrain.",
  "The skyline uses the LOLA south-polar elevation model. It is coarse enough for a decision and is not a survey. Local boulders, lander tilt, and a real power or radio link budget are outside this tool.",
  "Communication means Earth is above the local horizon.",
];

type AboutDialogProps = {
  credit: string;
  onClose: () => void;
};

export function AboutDialog({ credit, onClose }: AboutDialogProps) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="about-title">About</h2>
        <p>{credit}</p>
        <ul>
          {LIMITS.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
        <button type="button" className="dialog-close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
