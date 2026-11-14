type CountdownRowProps = {
  sunset: string;
  earthset: string;
};

export function CountdownRow({ sunset, earthset }: CountdownRowProps) {
  return (
    <div className="countdown">
      <span>{sunset}</span>
      <span>{earthset}</span>
    </div>
  );
}
