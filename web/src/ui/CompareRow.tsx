type CompareRowProps = {
  sentence: string;
};

export function CompareRow({ sentence }: CompareRowProps) {
  return (
    <div className="compare">
      <span>{sentence}</span>
    </div>
  );
}
