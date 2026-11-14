type CountdownRowProps = {
  sunset: string;
  earthset: string;
};

export function CountdownRow({ sunset, earthset }: CountdownRowProps) {
  return (
    <div className="countdown">
      <p>{sunset}</p>
      <p>{earthset}</p>
    </div>
  );
}
