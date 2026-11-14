type CompareRowProps = {
  sentence: string;
};

export function CompareRow({ sentence }: CompareRowProps) {
  return (
    <div className="compare">
      <span>Compare with Nobile Rim 1. {sentence}</span>
    </div>
  );
}
