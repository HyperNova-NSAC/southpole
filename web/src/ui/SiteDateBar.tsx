import type { Site } from "../contract/types";

type SiteDateBarProps = {
  sites: Site[];
  siteId: string;
  landingDate: string;
  onSite: (siteId: string) => void;
  onDate: (date: string) => void;
};

export function SiteDateBar({ sites, siteId, landingDate, onSite, onDate }: SiteDateBarProps) {
  return (
    <div className="site-date">
      <label className="field">
        <span>Site</span>
        <select
          aria-label="Landing site"
          value={siteId}
          onChange={(event) => onSite(event.target.value)}
        >
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Date</span>
        <input
          type="date"
          aria-label="Landing date"
          value={landingDate}
          onChange={(event) => onDate(event.target.value)}
        />
      </label>
    </div>
  );
}
