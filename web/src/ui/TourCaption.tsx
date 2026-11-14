type TourCaptionProps = {
  step: number;
  total: number;
  title: string;
  body: string;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
};

export function TourCaption({ step, total, title, body, onBack, onNext, onClose }: TourCaptionProps) {
  const last = step === total - 1;
  return (
    <section className="tour" aria-label="Why the south pole is hard">
      <p className="tour-kicker">
        {title} · {step + 1} of {total}
      </p>
      <p>{body}</p>
      <div className="tour-actions">
        <button type="button" onClick={onBack} disabled={step === 0}>
          Back
        </button>
        <button type="button" onClick={onNext}>
          {last ? "Done" : "Next"}
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}
