type VerdictBannerProps = {
  sentence: string;
  tone?: "green" | "amber" | "red";
  note?: string | null;
};

export function VerdictBanner({ sentence, tone, note }: VerdictBannerProps) {
  return (
    <section className={tone ? `verdict ${tone}` : "verdict"} aria-label="Landing decision">
      <h1>{sentence}</h1>
      {note ? <p className="verdict-note">{note}</p> : null}
    </section>
  );
}
