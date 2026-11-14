import type { MissionProfile } from "../contract/types";
import { SegmentedControl } from "./SegmentedControl";

type NavBarProps = {
  profiles: MissionProfile[];
  profileId: string;
  onProfile: (profileId: string) => void;
  onTour: () => void;
  onAbout: () => void;
};

/** Translucent top bar: wordmark, mission profile switch, and help links. */
export function NavBar({ profiles, profileId, onProfile, onTour, onAbout }: NavBarProps) {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="wordmark">
          <span className="wordmark-mark" aria-hidden="true" />
          Lunar Skyline
        </div>
        {profiles.length > 0 ? (
          <SegmentedControl
            label="Mission profile"
            options={profiles.map((profile) => ({ value: profile.id, label: profile.label }))}
            value={profileId}
            onChange={onProfile}
          />
        ) : null}
        <div className="navbar-links">
          <button type="button" className="link-button" onClick={onTour}>
            Why is the pole hard?
          </button>
          <button type="button" className="link-button" onClick={onAbout}>
            About
          </button>
        </div>
      </div>
    </nav>
  );
}
