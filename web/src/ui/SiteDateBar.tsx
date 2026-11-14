import type { Site } from "../contract/types";

type SiteDateBarProps = {
  sites: Site[];
  siteId: string;
  landingDate: string;
};

export function SiteDateBar({ sites, siteId, landingDate }: SiteDateBarProps) {
  return (
    <div className="site-date">
      <label>
        Where{" "}
        <select defaultValue={siteId} aria-label="Landing site">
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        When <input type="date" defaultValue={landingDate} aria-label="Landing date" />
      </label>
    </div>
  );
}
