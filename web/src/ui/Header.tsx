import type { MissionProfile } from "../contract/types";

type HeaderProps = {
  profiles: MissionProfile[];
  profileId: string;
  onProfile: (profileId: string) => void;
};

export function Header({ profiles, profileId, onProfile }: HeaderProps) {
  return (
    <header className="header">
      <div className="wordmark">Lunar Skyline</div>
      <div className="header-actions">
        <label className="field">
          <span>Mission</span>
          <select
            aria-label="Mission profile"
            value={profileId}
            onChange={(event) => onProfile(event.target.value)}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button">Why is the south pole hard?</button>
      </div>
    </header>
  );
}
