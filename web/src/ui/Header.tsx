type HeaderProps = {
  profileLabel: string;
};

export function Header({ profileLabel }: HeaderProps) {
  return (
    <header className="header">
      <div className="wordmark">Lunar Skyline</div>
      <label>
        Landing{" "}
        <select defaultValue={profileLabel} aria-label="Mission profile">
          <option>{profileLabel}</option>
          <option disabled>Long stay, 100 days</option>
        </select>
      </label>
      <button type="button">Why is the south pole hard?</button>
    </header>
  );
}
