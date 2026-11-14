type CompareRowProps = {
  sentence: string;
};

export function CompareRow({ sentence }: CompareRowProps) {
  return (
    <div className="compare">
      <span className="compare-label">Compare</span>
      <p>{sentence}</p>
    </div>
  );
}
