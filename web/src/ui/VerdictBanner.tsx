type VerdictBannerProps = {
  sentence: string;
};

export function VerdictBanner({ sentence }: VerdictBannerProps) {
  return (
    <section className="verdict" aria-label="Landing decision">
      <h1>{sentence}</h1>
    </section>
  );
}
