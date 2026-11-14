import type { Site } from "../contract/types";

type CompareRowProps = {
  sites: Site[];
  compareSiteId: string;
  sentence: string;
  onCompare: (siteId: string) => void;
};

export function CompareRow({ sites, compareSiteId, sentence, onCompare }: CompareRowProps) {
  return (
    <div className="compare">
      <label className="compare-field">
        <span className="compare-label">Compare</span>
        <select
          aria-label="Comparison site"
          value={compareSiteId}
          onChange={(event) => onCompare(event.target.value)}
        >
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </label>
      <p>{sentence}</p>
    </div>
  );
}
